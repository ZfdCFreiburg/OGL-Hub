// Supabase Edge Function: github-admin
// Verwaltet site-config.json und Dateien über GitHub Releases (bis 2 GB/Datei, kein 1-GB-Gesamtlimit).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugifyFolder(folder: string): string {
  const clean = folder
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `hub-${clean || "allgemein"}`;
}

async function ghFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || `GitHub API Fehler (${res.status})`);
  }
  return data;
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Nicht angemeldet");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Ungültige Session");

  const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "zfdc@janboelmann.de").toLowerCase();
  const adminGithub = (Deno.env.get("ADMIN_GITHUB_USER") || "ZfdCFreiburg").toLowerCase();
  const userEmail = (user.email || "").toLowerCase();
  const userGithub = (
    user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username ||
    ""
  ).toLowerCase();

  if (userEmail !== adminEmail && userGithub !== adminGithub) {
    throw new Error("Zugriff verweigert");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ghToken = Deno.env.get("GITHUB_TOKEN");
    if (!ghToken) {
      return Response.json({ error: "GITHUB_TOKEN Secret fehlt" }, { status: 500, headers: corsHeaders });
    }

    const owner = Deno.env.get("GITHUB_OWNER") || "ZfdCFreiburg";
    const repo = Deno.env.get("GITHUB_REPO") || "OGL-Hub";
    const branch = Deno.env.get("GITHUB_BRANCH") || "main";
    const contentType = req.headers.get("Content-Type") || "";

    // Öffentliche, durch Portal-Zugangscode geschützte Dateiliste (ohne Admin-Login)
    if (!contentType.includes("multipart/form-data")) {
      const cloned = req.clone();
      const peek = await cloned.json().catch(() => ({}));
      if (peek?.action === "publicListReleases") {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        const { data: valid, error: rpcErr } = await sb.rpc("verify_portal_code", {
          p_room: peek.room || "general",
          p_code: peek.code || "",
        });
        if (rpcErr || !valid) {
          return Response.json({ error: "Falscher Zugangscode" }, { status: 403, headers: corsHeaders });
        }

        const releases = await ghFetch(ghToken, `/repos/${owner}/${repo}/releases?per_page=100`);
        const files = [];
        for (const rel of releases || []) {
          if (!String(rel.tag_name || "").startsWith("hub-")) continue;
          const folder = rel.name || "Allgemein";
          for (const asset of rel.assets || []) {
            files.push({
              assetId: asset.id,
              name: asset.name,
              folder,
              size: asset.size || 0,
              modifiedAt: asset.updated_at || asset.created_at,
              url: asset.browser_download_url,
            });
          }
        }
        return Response.json({ files }, { headers: corsHeaders });
      }
    }

    await requireAdmin(req);

    // Multipart-Upload eines Release-Assets
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const folderName = String(form.get("folder") || "").trim() || "Allgemein";
      if (!(file instanceof File)) {
        return Response.json({ error: "Keine Datei übergeben" }, { status: 400, headers: corsHeaders });
      }

      const tag = slugifyFolder(folderName);
      let release;
      try {
        release = await ghFetch(ghToken, `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`);
      } catch {
        release = await ghFetch(ghToken, `/repos/${owner}/${repo}/releases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag_name: tag,
            target_commitish: branch,
            name: folderName,
            body: `Dateien für Kategorie ${folderName}`,
            draft: false,
            prerelease: false,
          }),
        });
      }

      // Gleichnamiges Asset vorab ersetzen
      const existingAsset = (release.assets || []).find((a: { name: string }) => a.name === file.name);
      if (existingAsset) {
        await ghFetch(ghToken, `/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
          method: "DELETE",
        });
      }

      const uploadBase = String(release.upload_url).replace("{?name,label}", "");
      const buf = await file.arrayBuffer();
      const upRes = await fetch(`${uploadBase}?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${ghToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": file.type || "application/octet-stream",
          "Content-Length": String(buf.byteLength),
        },
        body: buf,
      });
      const upData = await upRes.json();
      if (!upRes.ok) {
        throw new Error(upData?.message || "Release-Upload fehlgeschlagen");
      }
      return Response.json(upData, { headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "getConfig") {
      const data = await ghFetch(ghToken, `/repos/${owner}/${repo}/contents/site-config.json?ref=${branch}`);
      return Response.json(data, { headers: corsHeaders });
    }

    if (action === "saveConfig") {
      const data = await ghFetch(ghToken, `/repos/${owner}/${repo}/contents/site-config.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update site-config.json via Admin UI",
          content: body.content,
          branch,
          ...(body.sha ? { sha: body.sha } : {}),
        }),
      });
      return Response.json(data, { headers: corsHeaders });
    }

    if (action === "listReleases") {
      const releases = await ghFetch(ghToken, `/repos/${owner}/${repo}/releases?per_page=100`);
      const files = [];
      for (const rel of releases || []) {
        if (!String(rel.tag_name || "").startsWith("hub-")) continue;
        const folder = rel.name || "Allgemein";
        for (const asset of rel.assets || []) {
          files.push({
            assetId: asset.id,
            name: asset.name,
            folder,
            path: `${folder}/${asset.name}`,
            size: asset.size || 0,
            modifiedAt: asset.updated_at || asset.created_at,
            url: asset.browser_download_url,
          });
        }
      }
      return Response.json({ files }, { headers: corsHeaders });
    }

    if (action === "deleteReleaseAsset") {
      const assetId = Number(body.assetId);
      if (!assetId) {
        return Response.json({ error: "assetId fehlt" }, { status: 400, headers: corsHeaders });
      }
      await ghFetch(ghToken, `/repos/${owner}/${repo}/releases/assets/${assetId}`, {
        method: "DELETE",
      });
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "deployStatus") {
      const runs = await ghFetch(ghToken, `/repos/${owner}/${repo}/actions/workflows/deploy.yml/runs?per_page=1`);
      const latest = runs?.workflow_runs?.[0] || null;
      return Response.json(
        {
          status: latest?.status || "unknown",
          conclusion: latest?.conclusion || null,
          htmlUrl: latest?.html_url || null,
          updatedAt: latest?.updated_at || null,
        },
        { headers: corsHeaders }
      );
    }

    return Response.json({ error: "Unbekannte Aktion" }, { status: 400, headers: corsHeaders });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Nicht angemeldet" || msg === "Ungültige Session" ? 401 : msg === "Zugriff verweigert" ? 403 : 500;
    return Response.json({ error: msg }, { status, headers: corsHeaders });
  }
});
