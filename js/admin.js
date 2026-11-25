import { CONFIG } from "../config.js?v=14";

const { owner, repo, branch, allowedUsers, allowedEmails, supabaseFunctionName } = CONFIG.admin;
const STORAGE_KEY = "ogl-admin-token";

const state = {
  mode: null, // "supabase" | "token"
  token: "",
  supabaseClient: null,
  configSha: null,
  selectedFiles: [],
  repoSizeBytes: 0,
};

const el = {
  brandLogo: document.getElementById("brand-logo"),
  loginSection: document.getElementById("login-section"),
  dashboardSection: document.getElementById("dashboard-section"),
  supabaseOauthBox: document.getElementById("supabase-oauth-box"),
  supabaseGithubBtn: document.getElementById("supabase-github-btn"),
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
  deployProgressBox: document.getElementById("deploy-progress-box"),
  deployProgressLabel: document.getElementById("deploy-progress-label"),
  deployProgressPercent: document.getElementById("deploy-progress-percent"),
  deployProgressFill: document.getElementById("deploy-progress-fill"),
  chatCodeForm: document.getElementById("chat-code-form"),
  cfgChatCode: document.getElementById("cfg-chat-code"),
  saveChatCodeBtn: document.getElementById("save-chat-code-btn"),
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
  refreshFilesBtn: document.getElementById("refresh-files-btn"),
  adminFileList: document.getElementById("admin-file-list"),
  refreshChatBtn: document.getElementById("refresh-chat-btn"),
  clearChatBtn: document.getElementById("clear-chat-btn"),
  adminChatList: document.getElementById("admin-chat-list"),
  toast: document.getElementById("toast"),
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

async function ghRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || `GitHub API Fehler (${res.status})`);
  }
  return data;
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

function encodePath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function textToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToText(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error(`Datei ${file.name} konnte nicht gelesen werden`));
    reader.readAsDataURL(file);
  });
}

async function openDashboard() {
  el.loginSection.classList.add("hidden");
  el.dashboardSection.classList.remove("hidden");
  el.logoutBtn.classList.remove("hidden");
  await Promise.all([loadSiteConfig(), loadRepoFiles(), loadChatCode(), loadAdminChatMessages()]);
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

async function loadAdminChatMessages() {
  if (state.mode !== "supabase" || !state.supabaseClient) return;
  el.adminChatList.textContent = "Lade Nachrichten...";
  try {
    const room = CONFIG.supabase.roomName || "general";
    const { data, error } = await state.supabaseClient
      .from("chat_messages")
      .select("*")
      .eq("room", room)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    if (!data?.length) {
      el.adminChatList.innerHTML = `<p class="muted-text">Keine Chat-Nachrichten vorhanden.</p>`;
      return;
    }

    el.adminChatList.replaceChildren(
      ...data.map((msg) => {
        const row = document.createElement("div");
        row.className = "admin-file-row";
        if (msg.color) row.style.background = msg.color;

        const info = document.createElement("div");
        info.className = "admin-file-info";
        const author = document.createElement("strong");
        author.textContent = msg.author;
        const text = document.createElement("span");
        text.className = "admin-file-path";
        text.textContent = msg.content;
        const time = document.createElement("span");
        time.className = "muted-text";
        time.textContent = new Date(msg.created_at).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });
        info.append(author, text, time);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger";
        delBtn.textContent = "Löschen";
        delBtn.addEventListener("click", async () => {
          delBtn.disabled = true;
          const { error: delErr } = await state.supabaseClient
            .from("chat_messages")
            .delete()
            .eq("id", msg.id);
          if (delErr) {
            showToast(`Fehler: ${delErr.message}`);
            delBtn.disabled = false;
            return;
          }
          await broadcastChatEvent("delete_message", { id: msg.id });
          showToast("Nachricht gelöscht");
          await loadAdminChatMessages();
        });

        row.append(info, delBtn);
        return row;
      })
    );
  } catch (err) {
    el.adminChatList.textContent = `Fehler: ${err.message}`;
  }
}

async function clearAllChatMessages() {
  if (!confirm("Wirklich alle Chat-Nachrichten löschen?")) return;
  el.clearChatBtn.disabled = true;
  try {
    const room = CONFIG.supabase.roomName || "general";
    const { error } = await state.supabaseClient
      .from("chat_messages")
      .delete()
      .eq("room", room);
    if (error) throw error;
    await broadcastChatEvent("clear_all");
    showToast("Alle Nachrichten gelöscht");
    await loadAdminChatMessages();
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
  } finally {
    el.clearChatBtn.disabled = false;
  }
}

async function loadChatCode() {
  if (state.mode !== "supabase" || !state.supabaseClient) return;
  try {
    const { data, error } = await state.supabaseClient
      .from("chat_settings")
      .select("workshop_code")
      .eq("room", CONFIG.supabase.roomName || "general")
      .maybeSingle();
    if (!error && data) {
      el.cfgChatCode.value = data.workshop_code || "";
    }
  } catch {
    // ignore
  }
}

async function saveChatCode(e) {
  e.preventDefault();
  if (state.mode !== "supabase" || !state.supabaseClient) {
    showToast("Nur im Supabase-Modus verfügbar");
    return;
  }
  const code = el.cfgChatCode.value.trim();
  if (!code) {
    showToast("Bitte einen Workshop-Code eingeben");
    return;
  }
  el.saveChatCodeBtn.disabled = true;
  el.saveChatCodeBtn.textContent = "Speichere...";
  try {
    const room = CONFIG.supabase.roomName || "general";
    const { error } = await state.supabaseClient
      .from("chat_settings")
      .upsert({
        room,
        workshop_code: code,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    showToast("Workshop-Code gespeichert");
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
  } finally {
    el.saveChatCodeBtn.disabled = false;
    el.saveChatCodeBtn.textContent = "Workshop-Code speichern";
  }
}

async function initSupabaseAuth() {
  const sb = CONFIG.supabase;
  if (!sb?.url || !sb?.anonKey) return;

  el.supabaseOauthBox.classList.remove("hidden");
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

async function loginWithSupabaseGithub() {
  clearLoginError();
  if (!state.supabaseClient) return;
  const { error } = await state.supabaseClient.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) {
    showLoginError(error.message);
  }
}

async function loginWithSupabase(email, password) {
  clearLoginError();
  el.supabaseLoginSubmit.disabled = true;
  el.supabaseLoginSubmit.textContent = "Melde an...";

  try {
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

async function authenticateWithToken(token, persist) {
  clearLoginError();
  el.loginSubmit.disabled = true;
  el.loginSubmit.textContent = "Prüfe Zugang...";
  state.token = token.trim();

  try {
    const user = await ghRequest("/user");
    const allowed = allowedUsers.map((u) => u.toLowerCase());
    if (!allowed.includes((user.login || "").toLowerCase())) {
      throw new Error(`Zugriff verweigert: Account "${user.login}" ist nicht freigegeben.`);
    }

    const repoData = await ghRequest(`/repos/${owner}/${repo}`);
    if (!repoData.permissions?.push) {
      throw new Error(`Token hat keine Schreibrechte (Contents: Read and write) für ${owner}/${repo}.`);
    }
    state.repoSizeBytes = (repoData.size || 0) * 1024;
    state.mode = "token";

    if (persist) {
      localStorage.setItem(STORAGE_KEY, state.token);
    } else {
      sessionStorage.setItem(STORAGE_KEY, state.token);
    }

    await openDashboard(user.login);
  } catch (err) {
    state.token = "";
    state.mode = null;
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    showLoginError(err.message);
  } finally {
    el.loginSubmit.disabled = false;
    el.loginSubmit.textContent = "Mit Token anmelden";
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

async function saveSiteConfig(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;
  el.saveConfigBtn.disabled = true;
  el.saveConfigBtn.textContent = "Speichere...";

  try {
    const { error } = await state.supabaseClient
      .from("site_settings")
      .upsert({
        id: "default",
        page_title: el.cfgPageTitle.value.trim(),
        workshop_leader: el.cfgLeader.value.trim(),
        description: el.cfgDescription.value.trim(),
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    showToast("Workshop-Infos gespeichert (sofort live)");
  } catch (err) {
    showToast(`Fehler: ${err.message}`);
  } finally {
    el.saveConfigBtn.disabled = false;
    el.saveConfigBtn.textContent = "Konfiguration speichern";
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
  el.supabaseGithubBtn.addEventListener("click", loginWithSupabaseGithub);

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
    el.loginSection.classList.remove("hidden");
  });

  el.configForm.addEventListener("submit", saveSiteConfig);
  el.chatCodeForm.addEventListener("submit", saveChatCode);
  el.uploadForm.addEventListener("submit", uploadFiles);
  el.refreshFilesBtn.addEventListener("click", loadRepoFiles);
  el.refreshChatBtn.addEventListener("click", loadAdminChatMessages);
  el.clearChatBtn.addEventListener("click", clearAllChatMessages);

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

(async () => {
  await initSupabaseAuth();
  if (!state.mode) {
    const savedToken = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (savedToken) {
      await authenticateWithToken(savedToken, Boolean(localStorage.getItem(STORAGE_KEY)));
    }
  }
})();
