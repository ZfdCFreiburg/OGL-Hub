import { CONFIG } from "../config.js?v=14";

const state = {
  files: [],
  generatedAt: null,
  siteConfig: {},
  isAdmin: false,
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
  searchInput: document.getElementById("search-input"),
  categoryPills: document.getElementById("category-pills"),
  typeFilter: document.getElementById("type-filter"),
  sortSelect: document.getElementById("sort-select"),
  fileList: document.getElementById("file-list"),
  toast: document.getElementById("toast"),
  linkPreviewModal: document.getElementById("link-preview-modal"),
  linkPreviewTitle: document.getElementById("link-preview-title"),
  linkPreviewMeta: document.getElementById("link-preview-meta"),
  linkPreviewOpen: document.getElementById("link-preview-open"),
  linkPreviewFrame: document.getElementById("link-preview-frame"),
  portalGate: document.getElementById("portal-gate"),
  workshopPicker: document.getElementById("workshop-picker"),
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
  state.siteConfig = siteConfig || {};
  const pageTitle = (siteConfig.pageTitle || "").trim();
  const workshopLeader = (siteConfig.workshopLeader || "").trim();
  const description = (siteConfig.description ?? branding.description ?? "").trim();
  const tagline = (siteConfig.tagline ?? branding.tagline ?? "").trim();

  document.title = "OGL Hub";
  document.documentElement.style.setProperty("--accent", branding.accentColor);
  document.documentElement.style.setProperty("--accent-hover", branding.accentHoverColor);

  if (tagline) {
    el.brandTagline.textContent = tagline;
    el.brandTagline.classList.remove("hidden");
  } else {
    el.brandTagline.textContent = "";
    el.brandTagline.classList.add("hidden");
  }

  el.pageTitle.textContent = pageTitle;
  el.workshopLeaderName.textContent = workshopLeader;
  setHeaderSessionVisible(false);

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
    if (branding.footerProvider.url) {
      el.footerProvider.href = branding.footerProvider.url;
    }
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
  if (e === "link") return "link";
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

function getRemainingHoursLabel(iso) {
  if (!iso) return "";
  const expiresAt = new Date(iso).getTime() + 24 * 60 * 60 * 1000;
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return "Läuft bald ab";
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  return hours <= 1 ? "Noch < 1 Std." : `Noch ${hours} Std.`;
}

function openLinkPreview(item) {
  el.linkPreviewTitle.textContent = item.name;
  el.linkPreviewMeta.textContent = item.url;
  el.linkPreviewOpen.href = item.url;
  el.linkPreviewFrame.src = item.url;
  el.linkPreviewModal.classList.remove("hidden");
}

function closeLinkPreview() {
  el.linkPreviewModal.classList.add("hidden");
  el.linkPreviewFrame.src = "about:blank";
}

function renderFiles() {
  const items = getFilteredFiles();
  el.fileCount.textContent = `${items.length} ${items.length === 1 ? "Eintrag" : "Einträge"}`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = state.files.length
      ? "<p>Keine Einträge gefunden. Passe Suche oder Filter an.</p>"
      : `<p>Noch keine Dateien oder Links vorhanden.</p><p>${CONFIG.files.emptyStateHint}</p>`;
    el.fileList.replaceChildren(empty);
    return;
  }

  const cards = items.map((file) => {
    const isLink = file.isLink === true;
    const card = document.createElement("article");
    card.className = "file-card";

    const top = document.createElement("div");
    top.className = "file-card-top";

    const badge = document.createElement("div");
    badge.className = "file-badge";
    badge.textContent = isLink ? "LINK" : (file.ext || "FILE").slice(0, 4);

    const info = document.createElement("div");
    info.className = "file-info";

    const name = document.createElement("h3");
    name.className = "file-name";
    name.textContent = file.name;

    const meta = document.createElement("div");
    meta.className = "file-meta";
    if (isLink) {
      let host = "";
      try {
        host = new URL(file.url).hostname.replace(/^www\./, "");
      } catch {
        host = "Link";
      }
      meta.innerHTML = `<span class="file-folder">${escapeHtml(file.folder || "Links")}</span><span>${escapeHtml(host)}</span>`;
    } else {
      const ttlBadge = file.expiresAfter24h
        ? `<span class="file-ttl">${escapeHtml(getRemainingHoursLabel(file.modifiedAt))}</span>`
        : "";
      meta.innerHTML = `<span class="file-folder">${escapeHtml(file.folder || "Allgemein")}</span><span>${formatBytes(file.size)}</span><span>${formatDate(file.modifiedAt)}</span>${ttlBadge}`;
    }

    info.append(name, meta);
    top.append(badge, info);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    if (isLink) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "btn btn-secondary";
      prevBtn.textContent = "Vorschau";
      prevBtn.addEventListener("click", () => openLinkPreview(file));

      const openBtn = document.createElement("a");
      openBtn.className = "btn btn-primary";
      openBtn.href = file.url;
      openBtn.target = "_blank";
      openBtn.rel = "noopener noreferrer";
      openBtn.textContent = "Öffnen";
      actions.append(prevBtn, openBtn);
    } else {
      const dl = document.createElement("a");
      dl.className = "btn btn-primary";
      dl.href = encodeURI(file.url);
      dl.download = file.name;
      dl.textContent = "Download";
      actions.appendChild(dl);
    }

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
            expiresAfter24h: true,
          };
        });
      }
    } catch {
      releaseFiles = [];
    }
  }

  let linkItems = [];
  if (sb?.url && sb?.anonKey) {
    try {
      const linkRes = await fetch(`${sb.url}/rest/v1/rpc/get_portal_links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: sb.anonKey,
          Authorization: `Bearer ${sb.anonKey}`,
        },
        body: JSON.stringify({
          p_room: sb.roomName || "general",
          p_code: portalCode || "",
        }),
      });
      if (linkRes.ok) {
        const rows = await linkRes.json();
        linkItems = (rows || []).map((row) => ({
          name: row.title,
          folder: row.folder || "Links",
          ext: "link",
          size: 0,
          modifiedAt: row.created_at,
          url: row.url,
          isLink: true,
        }));
      }
    } catch {
      linkItems = [];
    }
  }

  state.files = [...linkItems, ...releaseFiles, ...staticFiles];
  state.generatedAt = releaseFiles[0]?.modifiedAt || linkItems[0]?.modifiedAt || generatedAt;
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

  document.querySelectorAll("[data-close-link-modal]").forEach((node) => {
    node.addEventListener("click", closeLinkPreview);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.linkPreviewModal?.classList.contains("hidden")) {
      closeLinkPreview();
    }
  });

  el.leaveRoomBtn?.addEventListener("click", () => {
    localStorage.removeItem("ogl-portal-code");
    [
      "ogl-chat-code",
      "ogl-chat-author",
      "ogl-chat-author-at",
      "ogl-chat-avatar",
      "ogl-chat-color",
      "ogl-chat-last-seen",
      "ogl-chat-reacted",
    ].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    window.location.reload();
  });

  // Subtiles Easter Egg: 5x Klick auf das OGL-Logo
  let logoClicks = 0;
  let resetTimer = null;
  el.brandLogo?.addEventListener("click", () => {
    logoClicks += 1;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      logoClicks = 0;
    }, 1400);
    if (logoClicks >= 5) {
      logoClicks = 0;
      el.brandLogo.classList.remove("xp-pop");
      void el.brandLogo.offsetWidth;
      el.brandLogo.classList.add("xp-pop");
      const rect = el.brandLogo.getBoundingClientRect();
      const xp = document.createElement("span");
      xp.className = "xp-float";
      xp.textContent = "+100 XP";
      xp.style.left = `${rect.left + rect.width / 2}px`;
      xp.style.top = `${rect.bottom + 4}px`;
      document.body.appendChild(xp);
      setTimeout(() => xp.remove(), 1100);
    }
  });
}

async function initOptionalChat(portalCode = "", sbClient = null, room = "general") {
  if (!CONFIG.supabase?.enabled || !CONFIG.supabase?.url || !CONFIG.supabase?.anonKey) {
    return;
  }
  const { initSupabaseChat } = await import("./supabase-chat.js?v=32");
  initSupabaseChat(
    CONFIG.supabase,
    portalCode,
    () => loadManifest(portalCode),
    async (info) => {
      if (info?.active === false) {
        lockPortal("Aktuell ist kein Workshop aktiv.");
        return;
      }
      const savedSession = localStorage.getItem(PORTAL_SESSION_KEY) || "";
      if (info?.session_id && savedSession && info.session_id !== savedSession) {
        lockPortal("Ein neuer Workshop wurde gestartet. Bitte neu anmelden.");
        return;
      }
      if (sbClient) {
        try {
          const stillValid = await checkPortalCode(sbClient, room, portalCode);
          if (!stillValid) {
            lockPortal("Der Workshop-Code wurde geändert. Bitte neu anmelden.");
          }
        } catch (err) {
          lockPortal(err?.message || "Workshop-Session beendet.");
        }
      }
    },
    (state.siteConfig?.workshopLeader || "").trim()
  );
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
const PORTAL_SESSION_KEY = "ogl-portal-session";

async function fetchWorkshopStatus(sbClient, room) {
  const { data, error } = await sbClient.rpc("chat_status", { p_room: room });
  if (error) throw error;
  return data || {};
}

async function checkPortalCode(sbClient, room, code) {
  const { data, error } = await sbClient.rpc("verify_portal_code", {
    p_room: room,
    p_code: code || "",
  });
  if (error) throw error;
  return Boolean(data);
}

function setHeaderSessionVisible(visible) {
  const pageTitle = (state.siteConfig?.pageTitle || "").trim();
  const workshopLeader = (state.siteConfig?.workshopLeader || "").trim();
  el.pageTitle.classList.toggle("hidden", !visible || !pageTitle);
  if (visible && state.isAdmin) {
    el.workshopLeaderName.textContent = "Du bist Workshop-Leitung";
    el.workshopLeader.classList.remove("hidden");
  } else {
    el.workshopLeaderName.textContent = workshopLeader;
    el.workshopLeader.classList.toggle("hidden", !visible || !workshopLeader);
  }
}

function renderWorkshopGate(isActive) {
  if (!el.workshopPicker) return;
  if (!isActive) {
    el.workshopPicker.innerHTML = `<p class="muted-text" style="margin:0;">Aktuell läuft kein Workshop.</p>`;
    el.portalGateForm.classList.add("hidden");
    el.gateIndicator?.classList.add("hidden");
    return;
  }

  const title = (state.siteConfig?.pageTitle || "").trim() || "Workshop";
  const leader = (state.siteConfig?.workshopLeader || "").trim();
  const desc = (state.siteConfig?.description || "").trim();

  const card = document.createElement("button");
  card.type = "button";
  card.className = "workshop-live-card";

  const top = document.createElement("div");
  top.className = "workshop-live-top";
  const badge = document.createElement("span");
  badge.className = "workshop-live-badge";
  badge.innerHTML = `<span class="chat-dot online"></span> Live`;
  const cta = document.createElement("span");
  cta.className = "workshop-live-cta";
  cta.textContent = "Teilnehmen →";
  top.append(badge, cta);

  const heading = document.createElement("strong");
  heading.className = "workshop-live-title";
  heading.textContent = title;

  card.append(top, heading);

  if (leader) {
    const meta = document.createElement("span");
    meta.className = "workshop-live-meta";
    meta.textContent = `Leitung: ${leader}`;
    card.appendChild(meta);
  }
  if (desc) {
    const sub = document.createElement("span");
    sub.className = "workshop-live-desc";
    sub.textContent = desc;
    card.appendChild(sub);
  }

  card.addEventListener("click", () => {
    card.classList.add("selected");
    el.portalGateForm.classList.remove("hidden");
    el.gateIndicator?.classList.remove("hidden");
    el.portalCodeInput.focus();
  });

  el.workshopPicker.replaceChildren(card);
}

function lockPortal(reason = "") {
  localStorage.removeItem(PORTAL_CODE_KEY);
  localStorage.removeItem(PORTAL_SESSION_KEY);
  [
    "ogl-chat-code",
    "ogl-chat-author",
    "ogl-chat-author-at",
    "ogl-chat-avatar",
    "ogl-chat-color",
    "ogl-chat-last-seen",
    "ogl-chat-reacted",
  ].forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  setHeaderSessionVisible(false);
  el.portalContent.classList.add("hidden");
  el.leaveRoomBtn?.classList.add("hidden");
  document.getElementById("chat-widget")?.classList.add("hidden");
  closeLinkPreview();
  el.portalGate.classList.remove("hidden");
  el.portalGateForm.classList.add("hidden");
  el.portalGateBtn.disabled = false;
  el.portalGateBtn.textContent = "Beitreten";
  el.gateIndicator?.classList.add("hidden");
  el.gateIndicator?.classList.remove("verifying", "success", "error");
  el.gateCheck?.classList.add("hidden");
  el.gateCross?.classList.add("hidden");
  if (reason) {
    el.portalGateError.textContent = reason;
    el.portalGateError.classList.remove("hidden");
  } else {
    el.portalGateError.classList.add("hidden");
  }
  renderWorkshopGate(false);
}

async function unlockPortal(code, sbClient = null, room = "general") {
  if (sbClient) {
    try {
      const { data: sessionData } = await sbClient.auth.getSession();
      const u = sessionData?.session?.user;
      if (u) {
        const em = (u.email || "").toLowerCase();
        const gh = (u.user_metadata?.user_name || "").toLowerCase();
        state.isAdmin =
          em === "zfdc@janboelmann.de" ||
          em === "admin@ogl-hub.local" ||
          gh === "zfdcfreiburg";
      }
    } catch {
      state.isAdmin = false;
    }
  }
  setHeaderSessionVisible(true);
  el.portalGate.classList.add("hidden");
  el.portalContent.classList.remove("hidden");
  el.leaveRoomBtn?.classList.remove("hidden");
  if (sbClient) {
    try {
      const status = await fetchWorkshopStatus(sbClient, room);
      if (status?.session_id) {
        localStorage.setItem(PORTAL_SESSION_KEY, status.session_id);
      }
    } catch {
      // ignore
    }
  }
  await Promise.all([loadManifest(code), initOptionalChat(code, sbClient, room)]);

  if (sbClient && !unlockPortal.watcherBound) {
    unlockPortal.watcherBound = true;
    const verifyActive = async () => {
      const currentCode = (localStorage.getItem(PORTAL_CODE_KEY) || "").trim();
      if (!currentCode) return;
      try {
        const status = await fetchWorkshopStatus(sbClient, room);
        const savedSession = localStorage.getItem(PORTAL_SESSION_KEY) || "";
        if (!status?.session_active) {
          lockPortal("Aktuell ist kein Workshop aktiv.");
          return;
        }
        if (savedSession && status.session_id && status.session_id !== savedSession) {
          lockPortal("Ein neuer Workshop wurde gestartet. Bitte neu anmelden.");
          return;
        }
        const ok = await checkPortalCode(sbClient, room, currentCode);
        if (!ok) lockPortal("Der Workshop-Code wurde geändert. Bitte neu anmelden.");
      } catch (err) {
        lockPortal(err?.message || "Aktuell ist kein Workshop aktiv.");
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) verifyActive();
    });
    setInterval(verifyActive, 60000);
  }
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
    if (urlParams.get("chat") === "1") {
      document.body.classList.add("chat-standalone");
    }
    const urlCode = (urlParams.get("code") || "").trim();
    if (urlCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      try {
        if (await checkPortalCode(sbClient, room, urlCode)) {
          localStorage.setItem(PORTAL_CODE_KEY, urlCode);
          await unlockPortal(urlCode, sbClient, room);
          return;
        }
      } catch (err) {
        el.portalGateError.textContent = err.message || "Aktuell ist kein Workshop aktiv.";
        el.portalGateError.classList.remove("hidden");
      }
    }

    const savedCode = (localStorage.getItem(PORTAL_CODE_KEY) || "").trim();
    if (savedCode) {
      try {
        if (await checkPortalCode(sbClient, room, savedCode)) {
          await unlockPortal(savedCode, sbClient, room);
          return;
        }
      } catch {
        // Session nicht aktiv -> Sperre anzeigen
      }
    }

    localStorage.removeItem(PORTAL_CODE_KEY);
    el.portalGate.classList.remove("hidden");
    try {
      const status = await fetchWorkshopStatus(sbClient, room);
      renderWorkshopGate(Boolean(status?.session_active));
    } catch {
      renderWorkshopGate(false);
    }

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
          el.portalGateBtn.textContent = "Beitreten";
          return;
        }

        el.gateIndicator.classList.add("success");
        el.gateCheck.classList.remove("hidden");
        el.portalGateBtn.textContent = "Beigetreten";
        localStorage.setItem(PORTAL_CODE_KEY, entered);
        await new Promise((r) => setTimeout(r, 720));
        await unlockPortal(entered, sbClient, room);
      } catch (err) {
        el.gateIndicator.classList.remove("verifying");
        el.gateIndicator.classList.add("error");
        el.gateCross.classList.remove("hidden");
        el.portalGateError.textContent = err.message || "Prüfung fehlgeschlagen";
        el.portalGateError.classList.remove("hidden");
        el.portalGateBtn.disabled = false;
        el.portalGateBtn.textContent = "Beitreten";
      }
    });
  } catch {
    el.portalGate.classList.remove("hidden");
    el.portalGateError.textContent = "Verbindung zu Supabase fehlgeschlagen.";
    el.portalGateError.classList.remove("hidden");
  }
}

init();
