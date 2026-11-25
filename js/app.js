import { CONFIG } from "../config.js";

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
  brandName: document.getElementById("brand-name"),
  brandTagline: document.getElementById("brand-tagline"),
  pageTitle: document.getElementById("page-title"),
  workshopLeader: document.getElementById("workshop-leader"),
  brandDescription: document.getElementById("brand-description"),
  footerText: document.getElementById("footer-text"),
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
  previewModal: document.getElementById("preview-modal"),
  previewTitle: document.getElementById("preview-title"),
  previewMeta: document.getElementById("preview-meta"),
  previewDownload: document.getElementById("preview-download"),
  previewBody: document.getElementById("preview-body"),
  toast: document.getElementById("toast"),
  chatToggle: document.getElementById("chat-toggle"),
  chatToggleLabel: document.getElementById("chat-toggle-label"),
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

  el.brandName.textContent = branding.name;
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
    el.workshopLeader.textContent = `Workshopleitung: ${workshopLeader}`;
    el.workshopLeader.classList.remove("hidden");
  } else {
    el.workshopLeader.classList.add("hidden");
  }

  el.brandDescription.textContent = description;
  el.footerText.textContent = branding.footerText;

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

function isPreviewable(ext) {
  const e = (ext || "").toLowerCase();
  return ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "md", "json", "csv"].includes(e);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.add("hidden"), 2400);
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

function openPreview(file) {
  const ext = (file.ext || "").toLowerCase();
  const url = encodeURI(file.url);

  el.previewTitle.textContent = file.name;
  el.previewMeta.textContent = `${file.folder || "Allgemein"} · ${formatBytes(file.size)} · ${formatDate(file.modifiedAt)}`;
  el.previewDownload.href = url;
  el.previewDownload.download = file.name;
  el.previewBody.replaceChildren();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    el.previewBody.appendChild(img);
  } else if (ext === "pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = file.name;
    el.previewBody.appendChild(iframe);
  } else {
    const pre = document.createElement("pre");
    pre.textContent = "Lade Vorschau...";
    el.previewBody.appendChild(pre);
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("Fehler beim Laden"))))
      .then((text) => {
        pre.textContent = text.slice(0, 100_000);
      })
      .catch(() => {
        pre.textContent = "Vorschau konnte nicht geladen werden.";
      });
  }

  el.previewModal.classList.remove("hidden");
}

function closePreview() {
  el.previewModal.classList.add("hidden");
  el.previewBody.replaceChildren();
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

    if (isPreviewable(file.ext)) {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "btn btn-secondary";
      previewBtn.textContent = "Vorschau";
      previewBtn.addEventListener("click", () => openPreview(file));
      actions.appendChild(previewBtn);
    }

    const dl = document.createElement("a");
    dl.className = "btn btn-primary";
    dl.href = encodeURI(file.url);
    dl.download = file.name;
    dl.textContent = "Download";
    actions.appendChild(dl);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "icon-btn";
    copyBtn.title = "Direktlink kopieren";
    copyBtn.setAttribute("aria-label", "Direktlink kopieren");
    copyBtn.textContent = "🔗";
    copyBtn.addEventListener("click", async () => {
      const absoluteUrl = new URL(encodeURI(file.url), window.location.href).href;
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        showToast("Link in Zwischenablage kopiert");
      } catch {
        showToast("Kopieren nicht unterstützt");
      }
    });
    actions.appendChild(copyBtn);

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

async function loadManifest() {
  try {
    const res = await fetch("./files-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.files = Array.isArray(data.files) ? data.files : [];
    state.generatedAt = data.generatedAt || null;
    el.lastUpdated.textContent = `Stand: ${formatDate(state.generatedAt)}`;
  } catch {
    state.files = [];
    el.lastUpdated.textContent = "Stand: —";
  }
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

  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", closePreview);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.previewModal.classList.contains("hidden")) {
      closePreview();
    }
  });
}

async function initOptionalChat() {
  if (!CONFIG.supabase?.enabled || !CONFIG.supabase?.url || !CONFIG.supabase?.anonKey) {
    return;
  }
  el.chatToggle.classList.remove("hidden");
  el.chatToggleLabel.textContent = CONFIG.supabase.chatTitle || "Chat";
  const { initSupabaseChat } = await import("./supabase-chat.js");
  initSupabaseChat(CONFIG.supabase);
}

async function loadSiteConfig() {
  try {
    const res = await fetch("./site-config.json", { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function init() {
  const siteConfig = await loadSiteConfig();
  applyBranding(siteConfig);
  bindEvents();
  loadManifest();
  initOptionalChat();
}

init();
