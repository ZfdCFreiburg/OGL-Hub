import { CONFIG } from "../config.js?v=14";

const state = {
  files: [],
  generatedAt: null,
  search: "",
  category: "all",
  type: "all",
  sort: CONFIG.files.defaultSort || "date-desc",
};

const el = {
  brandLogo: document.getElementById("brand-logo"),
  brandTagline: document.getElementById("brand-tagline"),
  pageTitle: document.getElementById("page-title"),
  workshopLeader: document.getElementById("workshop-leader"),
  workshopLeaderName: document.getElementById("workshop-leader-name"),
  brandDescription: document.getElementById("brand-description"),
  footerLinks: document.getElementById("footer-links"),
  footerProvider: document.getElementById("footer-provider"),
  footerProviderLabel: document.getElementById("footer-provider-label"),
  footerProviderLogo: document.getElementById("footer-provider-logo"),
  fileCount: document.getElementById("file-count"),
  lastUpdated: document.getElementById("last-updated"),
  searchInput: document.getElementById("search-input"),
  categoryPills: document.getElementById("category-pills"),
  typeFilter: document.getElementById("type-filter"),
  sortSelect: document.getElementById("sort-select"),
  fileList: document.getElementById("file-list"),
  toast: document.getElementById("toast"),
  portalGate: document.getElementById("portal-gate"),
  portalGateForm: document.getElementById("portal-gate-form"),
  portalCodeInput: document.getElementById("portal-code-input"),
  portalGateError: document.getElementById("portal-gate-error"),
  portalGateBtn: document.getElementById("portal-gate-btn"),
  gateIndicator: document.getElementById("gate-indicator"),
  gateCheck: document.getElementById("gate-check"),
  gateCross: document.getElementById("gate-cross"),
  leaveRoomBtn: document.getElementById("leave-room-btn"),
  portalContent: document.getElementById("portal-content"),
};

function applyBranding(siteConfig = {}) {
  const { branding } = CONFIG;
  const pageTitle = (siteConfig.pageTitle || "").trim();
  const workshopLeader = (siteConfig.workshopLeader || "").trim();
  const description = (siteConfig.description ?? branding.description ?? "").trim();
  const tagline = (siteConfig.tagline ?? branding.tagline ?? "").trim();

  document.title = pageTitle ? `${pageTitle} — ${branding.name}` : branding.name;
  document.documentElement.style.setProperty("--accent", branding.accentColor);
  document.documentElement.style.setProperty("--accent-hover", branding.accentHoverColor);

  if (tagline) {
    el.brandTagline.textContent = tagline;
    el.brandTagline.classList.remove("hidden");
  } else {
    el.brandTagline.textContent = "";
    el.brandTagline.classList.add("hidden");
  }

  if (pageTitle) {
    el.pageTitle.textContent = pageTitle;
    el.pageTitle.classList.remove("hidden");
  } else {
    el.pageTitle.classList.add("hidden");
  }

  if (workshopLeader) {
    el.workshopLeaderName.textContent = workshopLeader;
    el.workshopLeader.classList.remove("hidden");
  } else {
    el.workshopLeader.classList.add("hidden");
  }

  if (description) {
    el.brandDescription.textContent = description;
    el.brandDescription.classList.remove("hidden");
  } else {
    el.brandDescription.textContent = "";
    el.brandDescription.classList.add("hidden");
  }

  if (branding.logoUrl) {
    const img = document.createElement("img");
    img.src = branding.logoUrl;
    img.alt = branding.name;
    el.brandLogo.classList.add("has-image");
    el.brandLogo.replaceChildren(img);
  } else {
    el.brandLogo.classList.remove("has-image");
    const initials = branding.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    el.brandLogo.textContent = initials || "OH";
  }

  if (branding.footerProvider?.logoUrl) {
    const labelLines = (branding.footerProvider.label || "Bereitgestellt durch").split("\n");
    el.footerProviderLabel.replaceChildren();
    labelLines.forEach((line, idx) => {
      if (idx > 0) el.footerProviderLabel.appendChild(document.createElement("br"));
      el.footerProviderLabel.appendChild(document.createTextNode(line));
    });
    el.footerProviderLogo.src = branding.footerProvider.logoUrl;
    el.footerProviderLogo.alt = branding.footerProvider.alt || "";
    el.footerProvider.classList.remove("hidden");
  }

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

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** idx;
  return `${val < 10 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getFileCategoryGroup(ext) {
  const e = (ext || "").toLowerCase();
  if (["pdf", "doc", "docx", "odt", "txt", "md", "rtf"].includes(e)) return "document";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(e)) return "image";
  if (["xls", "xlsx", "ods", "csv"].includes(e)) return "spreadsheet";
  if (["zip", "tar", "gz", "7z", "rar"].includes(e)) return "archive";
  return "other";
}

function renderCategories() {
  const folders = Array.from(new Set(state.files.map((f) => f.folder || "Allgemein"))).sort();
  const options = ["all", ...folders];

  el.categoryPills.replaceChildren(
    ...options.map((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pill ${state.category === cat ? "active" : ""}`;
      btn.textContent = cat === "all" ? "Alle Ordner" : cat;
      btn.addEventListener("click", () => {
        state.category = cat;
        renderCategories();
        renderFiles();
      });
      return btn;
    })
  );
}

function getFilteredFiles() {
  const q = state.search.trim().toLowerCase();
  return state.files
    .filter((f) => {
      if (state.category !== "all" && (f.folder || "Allgemein") !== state.category) return false;
      if (state.type !== "all" && getFileCategoryGroup(f.ext) !== state.type) return false;
      if (q) {
        const hay = `${f.name} ${f.folder || ""} ${f.ext || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (state.sort) {
        case "date-asc":
          return new Date(a.modifiedAt) - new Date(b.modifiedAt);
        case "name-asc":
          return a.name.localeCompare(b.name, "de");
        case "size-desc":
          return b.size - a.size;
        case "date-desc":
        default:
          return new Date(b.modifiedAt) - new Date(a.modifiedAt);
      }
    });
}

function renderFiles() {
  const items = getFilteredFiles();
  el.fileCount.textContent = `${items.length} ${items.length === 1 ? "Datei" : "Dateien"}`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = state.files.length
      ? "<p>Keine Dateien gefunden. Passe Suche oder Filter an.</p>"
      : `<p>Noch keine Dateien vorhanden.</p><p>${CONFIG.files.emptyStateHint}</p>`;
    el.fileList.replaceChildren(empty);
    return;
  }

  const cards = items.map((file) => {
    const card = document.createElement("article");
    card.className = "file-card";

    const top = document.createElement("div");
    top.className = "file-card-top";

    const badge = document.createElement("div");
    badge.className = "file-badge";
    badge.textContent = (file.ext || "FILE").slice(0, 4);

    const info = document.createElement("div");
    info.className = "file-info";

    const name = document.createElement("h3");
    name.className = "file-name";
    name.textContent = file.name;

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.innerHTML = `<span class="file-folder">${escapeHtml(file.folder || "Allgemein")}</span><span>${formatBytes(file.size)}</span><span>${formatDate(file.modifiedAt)}</span>`;

    info.append(name, meta);
    top.append(badge, info);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const dl = document.createElement("a");
    dl.className = "btn btn-primary";
    dl.href = encodeURI(file.url);
    dl.download = file.name;
    dl.textContent = "Download";
    actions.appendChild(dl);

    card.append(top, actions);
    return card;
  });

  el.fileList.replaceChildren(...cards);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadManifest(portalCode = "") {
  let staticFiles = [];
  let generatedAt = null;
  try {
    const res = await fetch("./files-manifest.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      staticFiles = Array.isArray(data.files) ? data.files : [];
      generatedAt = data.generatedAt || null;
    }
  } catch {
    staticFiles = [];
  }

  let releaseFiles = [];
  const sb = CONFIG.supabase;
  const fnName = CONFIG.admin.supabaseFunctionName || "github-admin";
  if (sb?.url && sb?.anonKey) {
    try {
      const relRes = await fetch(`${sb.url}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
        body: JSON.stringify({
          action: "publicListReleases",
          room: sb.roomName || "general",
          code: portalCode,
        }),
      });
      if (relRes.ok) {
        const data = await relRes.json();
        releaseFiles = (data.files || []).map((asset) => {
          const ext = asset.name.includes(".") ? asset.name.split(".").pop().toLowerCase() : "";
          return {
            name: asset.name,
            folder: asset.folder || "Allgemein",
            ext,
            size: asset.size || 0,
            modifiedAt: asset.modifiedAt,
            url: asset.url,
          };
        });
      }
    } catch {
      releaseFiles = [];
    }
  }

  state.files = [...releaseFiles, ...staticFiles];
  state.generatedAt = releaseFiles[0]?.modifiedAt || generatedAt;
  el.lastUpdated.textContent = `Stand: ${formatDate(state.generatedAt)}`;
  renderCategories();
  renderFiles();
}

function bindEvents() {
  el.sortSelect.value = state.sort;

  el.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderFiles();
  });

  el.typeFilter.addEventListener("change", (e) => {
    state.type = e.target.value;
    renderFiles();
  });

  el.sortSelect.addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderFiles();
  });

  el.leaveRoomBtn?.addEventListener("click", () => {
    [
      "ogl-portal-code",
      "ogl-chat-code",
      "ogl-chat-author",
      "ogl-chat-author-at",
      "ogl-chat-last-seen",
    ].forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  });
}

async function initOptionalChat(portalCode = "") {
  if (!CONFIG.supabase?.enabled || !CONFIG.supabase?.url || !CONFIG.supabase?.anonKey) {
    return;
  }
  const { initSupabaseChat } = await import("./supabase-chat.js?v=26");
  initSupabaseChat(CONFIG.supabase, portalCode, () => loadManifest(portalCode));
}

async function loadSiteConfig() {
  const sb = CONFIG.supabase;
  if (sb?.url && sb?.anonKey) {
    try {
      const res = await fetch(
        `${sb.url}/rest/v1/site_settings?id=eq.default&select=page_title,workshop_leader,description`,
        {
          cache: "no-store",
          headers: {
            apikey: sb.anonKey,
            Authorization: `Bearer ${sb.anonKey}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]) {
          return {
            pageTitle: rows[0].page_title,
            workshopLeader: rows[0].workshop_leader,
            description: rows[0].description,
          };
        }
      }
    } catch {
      // Fallback auf site-config.json
    }
  }

  try {
    const res = await fetch("./site-config.json", { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

const PORTAL_CODE_KEY = "ogl-portal-code";

async function checkPortalCode(sbClient, room, code) {
  const { data, error } = await sbClient.rpc("verify_portal_code", {
    p_room: room,
    p_code: code || "",
  });
  if (error) throw error;
  return Boolean(data);
}

async function unlockPortal(code) {
  el.portalGate.classList.add("hidden");
  el.portalContent.classList.remove("hidden");
  el.leaveRoomBtn?.classList.remove("hidden");
  await Promise.all([loadManifest(code), initOptionalChat(code)]);
}

async function init() {
  const siteConfig = await loadSiteConfig();
  applyBranding(siteConfig);
  bindEvents();

  const sb = CONFIG.supabase;
  if (!sb?.url || !sb?.anonKey) {
    await unlockPortal("");
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sbClient = createClient(sb.url, sb.anonKey);
    const room = sb.roomName || "general";
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = (urlParams.get("code") || "").trim();
    if (urlCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      if (await checkPortalCode(sbClient, room, urlCode)) {
        localStorage.setItem(PORTAL_CODE_KEY, urlCode);
        await unlockPortal(urlCode);
        return;
      }
    }

    const savedCode = (localStorage.getItem(PORTAL_CODE_KEY) || "").trim();
    if (savedCode && (await checkPortalCode(sbClient, room, savedCode))) {
      await unlockPortal(savedCode);
      return;
    }

    localStorage.removeItem(PORTAL_CODE_KEY);
    el.portalGate.classList.remove("hidden");
    el.portalCodeInput.focus();

    el.portalGateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      el.portalGateError.classList.add("hidden");
      const entered = el.portalCodeInput.value.trim();
      if (!entered) return;

      el.gateIndicator.classList.remove("success", "error");
      el.gateIndicator.classList.add("verifying");
      el.gateCheck.classList.add("hidden");
      el.gateCross.classList.add("hidden");
      el.portalGateBtn.disabled = true;
      el.portalGateBtn.textContent = "Prüfe...";

      try {
        const ok = await checkPortalCode(sbClient, room, entered);
        el.gateIndicator.classList.remove("verifying");

        if (!ok) {
          el.gateIndicator.classList.add("error");
          el.gateCross.classList.remove("hidden");
          el.portalCodeInput.classList.remove("gate-shake");
          void el.portalCodeInput.offsetWidth;
          el.portalCodeInput.classList.add("gate-shake");
          el.portalGateError.textContent = "Falscher Workshop-Code.";
          el.portalGateError.classList.remove("hidden");
          el.portalGateBtn.disabled = false;
          el.portalGateBtn.textContent = "Freischalten";
          return;
        }

        el.gateIndicator.classList.add("success");
        el.gateCheck.classList.remove("hidden");
        el.portalGateBtn.textContent = "Freigeschaltet";
        localStorage.setItem(PORTAL_CODE_KEY, entered);
        await new Promise((r) => setTimeout(r, 720));
        await unlockPortal(entered);
      } catch (err) {
        el.gateIndicator.classList.remove("verifying");
        el.gateIndicator.classList.add("error");
        el.gateCross.classList.remove("hidden");
        el.portalGateError.textContent = err.message || "Prüfung fehlgeschlagen";
        el.portalGateError.classList.remove("hidden");
        el.portalGateBtn.disabled = false;
        el.portalGateBtn.textContent = "Freischalten";
      }
    });
  } catch {
    el.portalGate.classList.remove("hidden");
    el.portalGateError.textContent = "Verbindung zu Supabase fehlgeschlagen.";
    el.portalGateError.classList.remove("hidden");
  }
}

init();
