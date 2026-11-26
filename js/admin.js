import { CONFIG } from "../config.js?v=15";

const { owner, repo, branch, allowedUsers, allowedEmails, usernameMap, supabaseFunctionName } = CONFIG.admin;
const STORAGE_KEY = "ogl-admin-token";

const state = {
  mode: null, // "supabase" | "token"
  token: "",
  supabaseClient: null,
  configSha: null,
  savedConfigSnapshot: "",
  selectedFiles: [],
  repoSizeBytes: 0,
  isSessionLive: false,
  chatInitialized: false,
};

const el = {
  brandLogo: document.getElementById("brand-logo"),
  loginSection: document.getElementById("login-section"),
  dashboardSection: document.getElementById("dashboard-section"),
  supabaseLoginForm: document.getElementById("supabase-login-form"),
  emailInput: document.getElementById("email-input"),
  passwordInput: document.getElementById("password-input"),
  supabaseLoginSubmit: document.getElementById("supabase-login-submit"),
  loginError: document.getElementById("login-error"),
  logoutBtn: document.getElementById("logout-btn"),
  configForm: document.getElementById("config-form"),
  cfgPageTitle: document.getElementById("cfg-page-title"),
  cfgLeader: document.getElementById("cfg-leader"),
  cfgDescription: document.getElementById("cfg-description"),
  saveConfigBtn: document.getElementById("save-config-btn"),
  showQrBtn: document.getElementById("show-qr-btn"),
  endWorkshopBtn: document.getElementById("end-workshop-btn"),
  workshopStatusText: document.getElementById("workshop-status-text"),
  cfgChatCode: document.getElementById("cfg-chat-code"),
  genCodeBtn: document.getElementById("gen-code-btn"),
  uploadForm: document.getElementById("upload-form"),
  uploadFolder: document.getElementById("upload-folder"),
  folderSuggestions: document.getElementById("folder-suggestions"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  selectedFilesList: document.getElementById("selected-files"),
  uploadLimitError: document.getElementById("upload-limit-error"),
  uploadProgressBox: document.getElementById("upload-progress-box"),
  uploadProgressLabel: document.getElementById("upload-progress-label"),
  uploadProgressPercent: document.getElementById("upload-progress-percent"),
  uploadProgressFill: document.getElementById("upload-progress-fill"),
  uploadBtn: document.getElementById("upload-btn"),
  adminFileList: document.getElementById("admin-file-list"),
  linkForm: document.getElementById("link-form"),
  linkTitle: document.getElementById("link-title"),
  linkUrl: document.getElementById("link-url"),
  linkFolder: document.getElementById("link-folder"),
  addLinkBtn: document.getElementById("add-link-btn"),
  adminLinkList: document.getElementById("admin-link-list"),
  toast: document.getElementById("toast"),
  footerLinks: document.getElementById("footer-links"),
  footerProvider: document.getElementById("footer-provider"),
  footerProviderLabel: document.getElementById("footer-provider-label"),
  footerProviderLogo: document.getElementById("footer-provider-logo"),
};

function initHeaderBranding() {
  const { branding } = CONFIG;
  document.documentElement.style.setProperty("--accent", branding.accentColor);
  document.documentElement.style.setProperty("--accent-hover", branding.accentHoverColor);

  if (branding.logoUrl) {
    const img = document.createElement("img");
    img.src = branding.logoUrl;
    img.alt = branding.name;
    el.brandLogo.classList.add("has-image");
    el.brandLogo.replaceChildren(img);
  }

  if (branding.footerProvider?.logoUrl && el.footerProvider) {
    const labelLines = (branding.footerProvider.label || "Bereitgestellt durch").split("\n");
    el.footerProviderLabel.replaceChildren();
    labelLines.forEach((line, idx) => {
      if (idx > 0) el.footerProviderLabel.appendChild(document.createElement("br"));
      el.footerProviderLabel.appendChild(document.createTextNode(line));
    });
    el.footerProviderLogo.src = branding.footerProvider.logoUrl;
    el.footerProviderLogo.alt = branding.footerProvider.alt || "";
    if (branding.footerProvider.url) {
      el.footerProvider.href = branding.footerProvider.url;
    }
    el.footerProvider.classList.remove("hidden");
  }

  if (el.footerLinks) {
    el.footerLinks.replaceChildren(
      ...(branding.footerLinks || []).map((link) => {
        const a = document.createElement("a");
        a.href = link.url;
        a.textContent = link.label;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        return a;
      })
    );
  }
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.add("hidden"), 2800);
}

function showLoginError(msg) {
  el.loginError.textContent = msg;
  el.loginError.classList.remove("hidden");
}

function clearLoginError() {
  el.loginError.classList.add("hidden");
  el.loginError.textContent = "";
}

async function invokeSupabaseAdmin(payload) {
  const { data, error } = await state.supabaseClient.functions.invoke(
    supabaseFunctionName || "github-admin",
    { body: payload }
  );
  if (error) throw new Error(error.message || "Edge Function Fehler");
  if (data?.error) throw new Error(data.error);
  return data;
}

function currentConfigSnapshot() {
  return JSON.stringify({
    t: el.cfgPageTitle.value.trim(),
    c: el.cfgChatCode.value.trim(),
    l: el.cfgLeader.value.trim(),
    d: el.cfgDescription.value.trim(),
  });
}

function updateSaveConfigState() {
  const title = el.cfgPageTitle.value.trim();
  const code = el.cfgChatCode.value.trim();
  el.saveConfigBtn.disabled = state.isSessionLive || !title || !code;
  el.showQrBtn.disabled = !state.isSessionLive;
  if (el.endWorkshopBtn) el.endWorkshopBtn.disabled = !state.isSessionLive;
}

function updateWorkshopStatusLabel(active, startedAt) {
  if (!el.workshopStatusText) return;
  if (!active || !startedAt) {
    state.isSessionLive = false;
    el.workshopStatusText.textContent = "Status: Aktuell kein Workshop aktiv.";
    updateSaveConfigState();
    return;
  }
  const expiresMs = new Date(startedAt).getTime() + 24 * 60 * 60 * 1000;
  const remHours = Math.max(0, Math.ceil((expiresMs - Date.now()) / (60 * 60 * 1000)));
  if (remHours <= 0) {
    state.isSessionLive = false;
    el.workshopStatusText.textContent = "Status: Abgelaufen (max. 24 Std.).";
  } else {
    state.isSessionLive = true;
    el.workshopStatusText.textContent = `Status: Workshop aktiv (noch ca. ${remHours} Std.)`;
  }
  updateSaveConfigState();
}

async function initAdminChat() {
  if (state.chatInitialized || !state.isSessionLive) return;
  if (!CONFIG.supabase?.enabled || !CONFIG.supabase?.url || !CONFIG.supabase?.anonKey) return;
  state.chatInitialized = true;
  const { initSupabaseChat } = await import("./supabase-chat.js?v=32");
  await initSupabaseChat(
    CONFIG.supabase,
    el.cfgChatCode.value.trim(),
    null,
    null,
    el.cfgLeader.value.trim()
  );
}

async function endWorkshopSession() {
  if (state.mode !== "supabase" || !state.supabaseClient) return;
  if (!confirm("Aktuellen Workshop beenden? Alle Teilnehmer werden abgemeldet.")) return;
  el.endWorkshopBtn.disabled = true;
  try {
    const room = CONFIG.supabase.roomName || "general";
    const now = new Date().toISOString();
    const { error } = await state.supabaseClient
      .from("chat_settings")
      .update({
        session_active: false,
        session_started_at: null,
        session_id: "",
        updated_at: now,
      })
      .eq("room", room);
    if (error) throw error;
    await broadcastChatEvent("session_updated", { active: false });
    updateWorkshopStatusLabel(false, null);
    document.getElementById("chat-widget")?.classList.add("hidden");
    showToast("Workshop beendet – Teilnehmer abgemeldet");
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
    el.endWorkshopBtn.disabled = false;
  }
}

async function openDashboard() {
  el.loginSection.classList.add("hidden");
  el.dashboardSection.classList.remove("hidden");
  el.logoutBtn.classList.remove("hidden");
  await Promise.all([loadSiteConfig(), loadRepoFiles(), loadChatCode(), loadAdminLinks()]);
  state.savedConfigSnapshot = currentConfigSnapshot();
  updateSaveConfigState();
  await initAdminChat();
}

async function loadAdminLinks() {
  if (state.mode !== "supabase" || !state.supabaseClient) return;
  el.adminLinkList.textContent = "Lade Links...";
  try {
    const room = CONFIG.supabase.roomName || "general";
    const { data, error } = await state.supabaseClient
      .from("hub_links")
      .select("*")
      .eq("room", room)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      el.adminLinkList.innerHTML = `<p class="muted-text">Noch keine Links freigegeben.</p>`;
      return;
    }

    el.adminLinkList.replaceChildren(
      ...data.map((item) => {
        const row = document.createElement("div");
        row.className = "admin-file-row";

        const info = document.createElement("div");
        info.className = "admin-file-info";
        const title = document.createElement("strong");
        title.textContent = item.title;
        const folder = document.createElement("span");
        folder.className = "file-folder";
        folder.textContent = item.folder || "Links";
        const urlSpan = document.createElement("span");
        urlSpan.className = "muted-text";
        urlSpan.textContent = item.url;
        info.append(title, folder, urlSpan);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger";
        delBtn.textContent = "Löschen";
        delBtn.addEventListener("click", async () => {
          delBtn.disabled = true;
          const { error: delErr } = await state.supabaseClient
            .from("hub_links")
            .delete()
            .eq("id", item.id);
          if (delErr) {
            showToast(`Fehler: ${delErr.message}`);
            delBtn.disabled = false;
            return;
          }
          await broadcastChatEvent("files_updated");
          showToast("Link gelöscht");
          await loadAdminLinks();
        });

        row.append(info, delBtn);
        return row;
      })
    );
  } catch (err) {
    el.adminLinkList.textContent = `Fehler: ${err.message}`;
  }
}

async function addAdminLink(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;
  const title = el.linkTitle.value.trim();
  const url = el.linkUrl.value.trim();
  const folder = el.linkFolder.value.trim() || "Links";
  if (!title || !url) return;

  el.addLinkBtn.disabled = true;
  try {
    const room = CONFIG.supabase.roomName || "general";
    const { error } = await state.supabaseClient.from("hub_links").insert({
      room,
      title,
      url,
      folder,
    });
    if (error) throw error;
    el.linkTitle.value = "";
    el.linkUrl.value = "";
    await broadcastChatEvent("files_updated");
    showToast("Link hinzugefügt");
    await loadAdminLinks();
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
  } finally {
    el.addLinkBtn.disabled = false;
  }
}

async function broadcastChatEvent(event, payload = {}) {
  if (!state.supabaseClient) return;
  const room = CONFIG.supabase.roomName || "general";
  const ch = state.supabaseClient.channel(`room:${room}`);
  await new Promise((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    setTimeout(resolve, 1200);
  });
  await ch.send({ type: "broadcast", event, payload });
  state.supabaseClient.removeChannel(ch);
}

async function loadChatCode() {
  if (state.mode !== "supabase" || !state.supabaseClient) return;
  try {
    const { data, error } = await state.supabaseClient
      .from("chat_settings")
      .select("workshop_code, session_active, session_started_at")
      .eq("room", CONFIG.supabase.roomName || "general")
      .maybeSingle();
    if (!error && data) {
      el.cfgChatCode.value = data.workshop_code || "";
      updateWorkshopStatusLabel(data.session_active, data.session_started_at);
    }
  } catch {
    // ignore
  }
}

async function openQrTab() {
  const code = el.cfgChatCode.value.trim();
  if (!code) {
    showToast("Bitte zuerst einen Workshop-Code eingeben");
    return;
  }

  const baseUrl = window.location.href.replace(/admin\.html.*$/, "");
  const shareUrl = `${baseUrl}?code=${encodeURIComponent(code)}`;
  const title = el.cfgPageTitle.value.trim() || CONFIG.branding.name;
  const logoAbsUrl = new URL(CONFIG.branding.logoUrl || "./assets/ogl-logo.png", window.location.href).href;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Pop-up blockiert – bitte Pop-ups für diese Seite erlauben");
    return;
  }

  let svg = "";
  try {
    const QRCode = (await import("https://esm.sh/qrcode@1.5.4")).default;
    svg = await QRCode.toString(shareUrl, { type: "svg", width: 340, margin: 1 });
  } catch {
    svg = "<p>QR-Code konnte nicht erzeugt werden.</p>";
  }

  const escape = (s) =>
    String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QR-Code — ${escape(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 40px 48px;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 20px;
      max-width: 520px;
      width: 100%;
    }
    .logo {
      height: 72px;
      width: auto;
      object-fit: contain;
    }
    h1 {
      margin: 0;
      font-size: 1.6rem;
      letter-spacing: -0.02em;
    }
    .qr svg {
      display: block;
      width: 300px;
      height: 300px;
    }
    .code-pill {
      padding: 10px 22px;
      border-radius: 999px;
      background: #f3e8ff;
      color: #5b21b6;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .url {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="${escape(logoAbsUrl)}" alt="OGL Logo" />
    <h1>${escape(title)}</h1>
    <div class="qr">${svg}</div>
    <div class="code-pill">Code: ${escape(code)}</div>
    <p class="url" style="font-size: 0.92rem; color: #334155;">Code wird beim Scannen automatisch übernommen.</p>
    <p class="url">${escape(shareUrl)}</p>
  </main>
</body>
</html>`);
  win.document.close();
}

async function saveSiteConfig(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;
  const code = el.cfgChatCode.value.trim();
  if (!code) {
    showToast("Bitte einen Workshop-Code eingeben");
    return;
  }

  el.saveConfigBtn.disabled = true;
  el.saveConfigBtn.textContent = "Speichere...";

  try {
    const room = CONFIG.supabase.roomName || "general";
    const now = new Date().toISOString();
    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const [siteRes, codeRes, chatRes] = await Promise.all([
      state.supabaseClient.from("site_settings").upsert({
        id: "default",
        page_title: el.cfgPageTitle.value.trim(),
        workshop_leader: el.cfgLeader.value.trim(),
        description: el.cfgDescription.value.trim(),
        updated_at: now,
      }),
      state.supabaseClient.from("chat_settings").upsert({
        room,
        workshop_code: code,
        pinned_message: "",
        session_active: true,
        session_started_at: now,
        session_id: newSessionId,
        updated_at: now,
      }),
      state.supabaseClient.from("chat_messages").delete().eq("room", room),
    ]);
    if (siteRes.error) throw siteRes.error;
    if (codeRes.error) throw codeRes.error;
    if (chatRes.error) throw chatRes.error;
    await broadcastChatEvent("clear_all");
    await broadcastChatEvent("session_updated", { active: true, session_id: newSessionId });
    updateWorkshopStatusLabel(true, now);
    document.getElementById("chat-widget")?.classList.remove("hidden");
    await initAdminChat();
    state.savedConfigSnapshot = currentConfigSnapshot();
    showToast("Workshop gestartet (max. 24 Std.) – Chat & alte Sessions zurückgesetzt");
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
  } finally {
    el.saveConfigBtn.textContent = "Workshop starten";
    updateSaveConfigState();
  }
}

async function initSupabaseAuth() {
  const sb = CONFIG.supabase;
  if (!sb?.url || !sb?.anonKey) return;

  el.supabaseLoginForm.classList.remove("hidden");

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  state.supabaseClient = createClient(sb.url, sb.anonKey);

  const { data } = await state.supabaseClient.auth.getSession();
  const user = data?.session?.user;
  if (user) {
    if (isSupabaseUserAllowed(user)) {
      state.mode = "supabase";
      await openDashboard(user.user_metadata?.user_name || user.email);
    } else {
      await state.supabaseClient.auth.signOut();
      showLoginError("Dieser Account ist nicht für den Admin-Bereich freigegeben.");
    }
  }
}

function isSupabaseUserAllowed(user) {
  const email = (user?.email || "").toLowerCase();
  const ghLogin = (user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || "").toLowerCase();
  const emailMatch = allowedEmails?.length
    ? allowedEmails.map((e) => e.toLowerCase()).includes(email)
    : false;
  const ghMatch = allowedUsers?.length
    ? allowedUsers.map((u) => u.toLowerCase()).includes(ghLogin)
    : false;

  if (!allowedEmails?.length && !allowedUsers?.length) return true;
  return emailMatch || ghMatch;
}

async function loginWithSupabase(identifier, password) {
  clearLoginError();
  el.supabaseLoginSubmit.disabled = true;
  el.supabaseLoginSubmit.textContent = "Melde an...";

  try {
    const raw = String(identifier || "").trim();
    const email = usernameMap?.[raw.toLowerCase()] || "";
    if (!email) {
      throw new Error("Unbekannter Benutzername.");
    }
    const { data, error } = await state.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!isSupabaseUserAllowed(data.user)) {
      await state.supabaseClient.auth.signOut();
      throw new Error("Diese E-Mail-Adresse ist nicht für den Admin-Bereich freigegeben.");
    }
    state.mode = "supabase";
    await openDashboard(data.user.user_metadata?.user_name || data.user.email);
  } catch (err) {
    showLoginError(err.message);
  } finally {
    el.supabaseLoginSubmit.disabled = false;
    el.supabaseLoginSubmit.textContent = "Anmelden";
  }
}

async function loadSiteConfig() {
  if (!state.supabaseClient) return;
  try {
    const { data, error } = await state.supabaseClient
      .from("site_settings")
      .select("page_title, workshop_leader, description")
      .eq("id", "default")
      .maybeSingle();
    if (!error && data) {
      el.cfgPageTitle.value = data.page_title || "";
      el.cfgLeader.value = data.workshop_leader || "";
      el.cfgDescription.value = data.description || "";
    }
  } catch {
    // ignore
  }
}

async function listSupabaseStorageFiles(bucket, prefix = "") {
  const { data, error } = await state.supabaseClient.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  const results = [];
  for (const item of data || []) {
    if (!item.name || item.name.startsWith(".")) continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) {
      const nested = await listSupabaseStorageFiles(bucket, fullPath);
      results.push(...nested);
    } else {
      results.push({
        path: fullPath,
        size: item.metadata?.size || 0,
        sha: null,
      });
    }
  }
  return results;
}

async function loadRepoFiles() {
  el.adminFileList.textContent = "Lade Dateien...";
  try {
    const data = await invokeSupabaseAdmin({ action: "listReleases" });
    const files = data.files || [];

    const folders = Array.from(
      new Set(
        files
          .map((f) => (f.folder && f.folder !== "Allgemein" ? f.folder : ""))
          .filter(Boolean)
      )
    ).sort();

    el.folderSuggestions.replaceChildren(
      ...folders.map((folder) => {
        const opt = document.createElement("option");
        opt.value = folder;
        return opt;
      })
    );

    if (!files.length) {
      el.adminFileList.innerHTML = `<p class="muted-text">Noch keine Dateien vorhanden.</p>`;
      return;
    }

    el.adminFileList.replaceChildren(
      ...files.map((item) => {
        const row = document.createElement("div");
        row.className = "admin-file-row";

        const info = document.createElement("div");
        info.className = "admin-file-info";
        const name = document.createElement("span");
        name.className = "admin-file-path";
        name.textContent = item.path;
        const size = document.createElement("span");
        size.className = "muted-text";
        size.textContent = formatBytes(item.size || 0);
        info.append(name, size);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger";
        delBtn.textContent = "Löschen";
        delBtn.addEventListener("click", () =>
          deleteRepoFile(item.path, item.assetId, delBtn)
        );

        row.append(info, delBtn);
        return row;
      })
    );
  } catch (err) {
    el.adminFileList.textContent = `Fehler beim Laden: ${err.message}`;
  }
}

async function deleteRepoFile(filePath, assetId, btn) {
  if (!confirm(`Datei "${filePath}" wirklich löschen?`)) return;
  btn.disabled = true;
  btn.textContent = "Lösche...";
  try {
    await invokeSupabaseAdmin({ action: "deleteReleaseAsset", assetId });
    await broadcastChatEvent("files_updated");
    showToast("Datei gelöscht");
    await loadRepoFiles();
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "Löschen";
  }
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function setSelectedFiles(fileList) {
  state.selectedFiles = Array.from(fileList || []);
  el.uploadLimitError.classList.add("hidden");
  el.uploadLimitError.textContent = "";

  if (!state.selectedFiles.length) {
    el.selectedFilesList.classList.add("hidden");
    el.selectedFilesList.replaceChildren();
    el.uploadBtn.disabled = true;
    return;
  }

  const oversized = state.selectedFiles.filter((f) => f.size > MAX_UPLOAD_BYTES);

  el.selectedFilesList.classList.remove("hidden");
  el.selectedFilesList.replaceChildren(
    ...state.selectedFiles.map((f) => {
      const li = document.createElement("li");
      const tooBig = f.size > MAX_UPLOAD_BYTES;
      li.textContent = `${f.name} (${formatBytes(f.size)})${tooBig ? " — zu groß (max. 50 MB)" : ""}`;
      if (tooBig) li.style.color = "#dc2626";
      return li;
    })
  );

  if (oversized.length) {
    el.uploadLimitError.textContent = `Upload nicht möglich: ${oversized.map((f) => f.name).join(", ")} überschreitet das Limit von 50 MB pro Datei.`;
    el.uploadLimitError.classList.remove("hidden");
    el.uploadBtn.disabled = true;
  } else {
    el.uploadBtn.disabled = false;
  }
}

async function pollDeployStatus() {
  el.deployProgressBox.classList.remove("hidden");
  el.deployProgressFill.classList.remove("done", "danger");
  el.deployProgressLabel.textContent = "GitHub Pages Build gestartet...";
  el.deployProgressPercent.textContent = "15 %";
  el.deployProgressFill.style.width = "15%";

  for (let i = 0; i < 24; i += 1) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const st = await invokeSupabaseAdmin({ action: "deployStatus" });
      if (st.status === "queued") {
        el.deployProgressLabel.textContent = "In Warteschlange (GitHub Pages)...";
        el.deployProgressPercent.textContent = "30 %";
        el.deployProgressFill.style.width = "30%";
      } else if (st.status === "in_progress") {
        el.deployProgressLabel.textContent = "Wird auf GitHub Pages veröffentlicht...";
        el.deployProgressPercent.textContent = "65 %";
        el.deployProgressFill.style.width = "65%";
      } else if (st.status === "completed") {
        if (st.conclusion === "success") {
          el.deployProgressLabel.textContent = "Live auf GitHub Pages ✓";
          el.deployProgressPercent.textContent = "100 %";
          el.deployProgressFill.style.width = "100%";
          el.deployProgressFill.classList.add("done");
        } else {
          el.deployProgressLabel.textContent = `Build beendet (${st.conclusion || "Fehler"})`;
          el.deployProgressFill.classList.add("danger");
        }
        return;
      }
    } catch {
      return;
    }
  }
}

function uploadWithProgress(url, formData, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded, ev.total);
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && !parsed.error) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.error || `Upload-Fehler (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload-Fehler (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.send(formData);
  });
}

async function verifyAssetLive(fileName) {
  for (let i = 0; i < 6; i += 1) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
        cache: "no-store",
      });
      if (res.ok) {
        const releases = await res.json();
        const found = releases.some((r) => (r.assets || []).some((a) => a.name === fileName));
        if (found) return true;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return false;
}

async function uploadFiles(e) {
  e.preventDefault();
  if (!state.selectedFiles.length) return;

  const cleanFolder = el.uploadFolder.value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");

  el.uploadBtn.disabled = true;
  el.uploadBtn.textContent = "Lade hoch...";
  el.uploadProgressBox.classList.remove("hidden");
  el.uploadProgressFill.classList.remove("done", "danger");

  let uploaded = 0;
  try {
    const { data: sessionData } = await state.supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const fnName = supabaseFunctionName || "github-admin";
    const totalFiles = state.selectedFiles.length;

    for (let idx = 0; idx < totalFiles; idx += 1) {
      const file = state.selectedFiles[idx];
      const form = new FormData();
      form.append("file", file);
      form.append("folder", cleanFolder || "Allgemein");

      await uploadWithProgress(
        `${CONFIG.supabase.url}/functions/v1/${fnName}`,
        form,
        {
          apikey: CONFIG.supabase.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        (loaded, total) => {
          const filePct = loaded / total;
          const overallPct = Math.round(((idx + filePct * 0.9) / totalFiles) * 100);
          el.uploadProgressLabel.textContent = `Hochladen (${idx + 1}/${totalFiles}): ${file.name} (${formatBytes(loaded)} / ${formatBytes(total)})`;
          el.uploadProgressPercent.textContent = `${overallPct} %`;
          el.uploadProgressFill.style.width = `${overallPct}%`;
        }
      );

      el.uploadProgressLabel.textContent = `Prüfe Live-Verfügbarkeit: ${file.name}...`;
      el.uploadProgressPercent.textContent = "95 %";
      el.uploadProgressFill.style.width = "95%";
      await verifyAssetLive(file.name);
      uploaded += 1;
    }

    el.uploadProgressLabel.textContent = `${uploaded} Datei(en) live auf der Download-Seite ✓`;
    el.uploadProgressPercent.textContent = "100 %";
    el.uploadProgressFill.style.width = "100%";
    el.uploadProgressFill.classList.add("done");

    await broadcastChatEvent("files_updated");
    showToast(`${uploaded} Datei(en) sind jetzt live`);
    el.fileInput.value = "";
    setSelectedFiles([]);
    await loadRepoFiles();
  } catch (err) {
    el.uploadProgressLabel.textContent = `Fehler: ${err.message}`;
    el.uploadProgressFill.classList.add("danger");
    showToast(`Upload-Fehler: ${err.message}`);
  } finally {
    el.uploadBtn.disabled = state.selectedFiles.length === 0;
    el.uploadBtn.textContent = "Hochladen";
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** idx;
  return `${val < 10 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}

function bindEvents() {
  el.supabaseLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginWithSupabase(el.emailInput.value.trim(), el.passwordInput.value);
  });

  el.logoutBtn.addEventListener("click", async () => {
    if (state.mode === "supabase" && state.supabaseClient) {
      await state.supabaseClient.auth.signOut();
    }
    state.token = "";
    state.mode = null;
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    el.passwordInput.value = "";
    el.dashboardSection.classList.add("hidden");
    el.logoutBtn.classList.add("hidden");
    document.getElementById("chat-widget")?.classList.add("hidden");
    el.loginSection.classList.remove("hidden");
  });

  el.configForm.addEventListener("submit", saveSiteConfig);
  el.showQrBtn.addEventListener("click", openQrTab);
  el.endWorkshopBtn?.addEventListener("click", endWorkshopSession);
  el.genCodeBtn?.addEventListener("click", () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    el.cfgChatCode.value = "OGL" + Array.from(bytes, (b) => String(b % 10)).join("");
    updateSaveConfigState();
  });
  [el.cfgPageTitle, el.cfgChatCode, el.cfgLeader, el.cfgDescription].forEach((input) => {
    input.addEventListener("input", updateSaveConfigState);
  });
  el.uploadForm.addEventListener("submit", uploadFiles);
  el.linkForm.addEventListener("submit", addAdminLink);

  el.dropzone.addEventListener("click", () => el.fileInput.click());
  el.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.fileInput.click();
    }
  });
  el.fileInput.addEventListener("change", (e) => setSelectedFiles(e.target.files));

  el.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.dropzone.classList.add("drag-over");
  });
  el.dropzone.addEventListener("dragleave", () => el.dropzone.classList.remove("drag-over"));
  el.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    el.dropzone.classList.remove("drag-over");
    if (e.dataTransfer?.files?.length) {
      setSelectedFiles(e.dataTransfer.files);
    }
  });
}

initHeaderBranding();
bindEvents();
initSupabaseAuth();
