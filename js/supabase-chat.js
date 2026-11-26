/**
 * Aufklappbares Supabase-Realtime-Chat-Widget unten rechts mit optionalem Workshop-Code.
 * - Zugeklappt: zeigt Online-Status (grüner Punkt), "OGL Chat" und Nachrichtenanzahl.
 * - Aufgeklappt: fragt nach Name (und Workshop-Code, falls im Admin-Panel gesetzt).
 */
export async function initSupabaseChat(supabaseConfig, initialPortalCode = "", onFilesUpdated = null) {
  const widget = document.getElementById("chat-widget");
  const bar = document.getElementById("chat-bar");
  const dot = document.getElementById("chat-online-dot");
  const titleEl = document.getElementById("chat-title");
  const presenceEl = document.getElementById("chat-presence");
  const countEl = document.getElementById("chat-count");
  const chevron = document.getElementById("chat-chevron");
  const panel = document.getElementById("chat-panel");

  const joinForm = document.getElementById("chat-join-form");
  const joinNameInput = document.getElementById("chat-join-name");
  const avatarPickerEl = document.getElementById("chat-avatar-picker");
  const joinError = document.getElementById("chat-join-error");
  const joinBtn = document.getElementById("chat-join-btn");

  const roomEl = document.getElementById("chat-room");
  const currentNameEl = document.getElementById("chat-current-name");
  const colorPickerEl = document.getElementById("chat-color-picker");
  const changeNameBtn = document.getElementById("chat-change-name");
  const pinnedEl = document.getElementById("chat-pinned");

  const messagesEl = document.getElementById("chat-messages");
  const noticeEl = document.getElementById("chat-inline-notice");
  const formEl = document.getElementById("chat-form");
  const textInput = document.getElementById("chat-input");
  const sendBtn = formEl.querySelector("button[type='submit']");

  const PASTEL_PALETTE = [
    "#f3e8ff", // Lavendel
    "#e0f2fe", // Himmelblau
    "#dcfce7", // Mint
    "#ffedd5", // Pfirsich
    "#ffe4e6", // Rosé
    "#fef9c3", // Zitrone
    "#ccfbf1", // Türkis
    "#e0e7ff", // Indigo
  ];

  const AVATARS = {
    "": { label: "Kein Avatar", svg: `<span style="font-size:0.7rem;color:var(--text-muted)">—</span>` },
    gamepad: {
      label: "Controller",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="5"/></svg>`,
    },
    rocket: {
      label: "Raumschiff",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`,
    },
    ghost: {
      label: "Arcade-Geist",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>`,
    },
    sword: {
      label: "Schwert",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/></svg>`,
    },
    dice: {
      label: "Würfel",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/></svg>`,
    },
    bot: {
      label: "Pixel-Bot",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9 14h.01"/><path d="M15 14h.01"/></svg>`,
    },
    crown: {
      label: "Krone",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 17l-2-9 5 4 5-7 5 7 5-4-2 9z"/></svg>`,
    },
  };

  const NAME_KEY = "ogl-chat-author";
  const NAME_TIME_KEY = "ogl-chat-author-at";
  const AVATAR_KEY = "ogl-chat-avatar";
  const COLOR_KEY = "ogl-chat-color";
  const LAST_SEEN_KEY = "ogl-chat-last-seen";
  const REACTED_KEY = "ogl-chat-reacted";
  const REACTION_EMOJIS = ["👍", "✅", "❤️", "🎉", "❓"];
  const MSG_TTL_MS = 3 * 60 * 60 * 1000; // 3 Stunden
  const SEND_COOLDOWN_MS = 3000;
  const CODE_KEY = "ogl-chat-code";

  // Chat-Eingaben nur pro Browser-Session speichern; alte localStorage-Reste bereinigen
  [NAME_KEY, NAME_TIME_KEY, AVATAR_KEY, COLOR_KEY, LAST_SEEN_KEY, REACTED_KEY, CODE_KEY].forEach(
    (k) => localStorage.removeItem(k)
  );

  const room = supabaseConfig.roomName || "general";
  let lastSentAt = 0;
  let chosenColor = (sessionStorage.getItem(COLOR_KEY) || "").trim();
  let chosenAvatar = (sessionStorage.getItem(AVATAR_KEY) || "").trim();
  let lastSeenAt = Number(sessionStorage.getItem(LAST_SEEN_KEY) || 0);
  let isAdminUser = false;
  let reactedMap = {};
  try {
    reactedMap = JSON.parse(sessionStorage.getItem(REACTED_KEY) || "{}") || {};
  } catch {
    reactedMap = {};
  }

  function readSavedName() {
    return (sessionStorage.getItem(NAME_KEY) || "").trim();
  }

  let authorName = readSavedName();
  let workshopCode = (initialPortalCode || sessionStorage.getItem(CODE_KEY) || "").trim();
  let codeRequired = false;
  let isAuthorized = false;
  let isOpen = false;
  let client = null;
  let channel = null;

  titleEl.textContent = supabaseConfig.chatTitle || "OGL Chat";
  widget.classList.remove("hidden");

  function setOnline(isOnline) {
    dot.classList.toggle("online", isOnline);
    dot.title = isOnline ? "Online (Live)" : "Verbinde...";
  }

  const baseDocTitle = document.title;

  const PIN_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
  const TRASH_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

  function setPinnedMessage(text) {
    const clean = (text || "").trim();
    if (!pinnedEl) return;
    if (clean) {
      pinnedEl.replaceChildren();
      const textWrap = document.createElement("span");
      textWrap.className = "chat-pinned-text";
      const pinIcon = document.createElement("span");
      pinIcon.className = "chat-pinned-icon";
      pinIcon.innerHTML = PIN_SVG;
      textWrap.appendChild(pinIcon);
      appendFormattedText(textWrap, clean);
      pinnedEl.appendChild(textWrap);

      if (isAdminUser) {
        const unpinBtn = document.createElement("button");
        unpinBtn.type = "button";
        unpinBtn.className = "chat-msg-action";
        unpinBtn.title = "Pin entfernen";
        unpinBtn.textContent = "✕";
        unpinBtn.addEventListener("click", () => adminPinMessage(""));
        pinnedEl.appendChild(unpinBtn);
      }
      pinnedEl.classList.remove("hidden");
    } else {
      pinnedEl.textContent = "";
      pinnedEl.classList.add("hidden");
    }
  }

  async function adminPinMessage(text) {
    if (!client || !isAdminUser) return;
    const { error } = await client
      .from("chat_settings")
      .update({ pinned_message: text, updated_at: new Date().toISOString() })
      .eq("room", room);
    if (error) {
      showNotice(error.message);
      return;
    }
    setPinnedMessage(text);
    if (channel) {
      await channel.send({ type: "broadcast", event: "pinned_updated", payload: { text } });
    }
  }

  async function adminDeleteMessage(id) {
    if (!client || !isAdminUser || !id) return;
    const { error } = await client.from(supabaseConfig.tableName).delete().eq("id", id);
    if (error) {
      showNotice(error.message);
      return;
    }
    const node = messagesEl.querySelector(`[data-id="${id}"]`);
    if (node) {
      node.remove();
      updateUnreadBadge();
    }
    if (channel) {
      await channel.send({ type: "broadcast", event: "delete_message", payload: { id } });
    }
  }

  function updateUnreadBadge() {
    if (isOpen) {
      lastSeenAt = Date.now();
      sessionStorage.setItem(LAST_SEEN_KEY, String(lastSeenAt));
      countEl.textContent = "0";
      countEl.classList.add("hidden");
      document.title = baseDocTitle;
      return;
    }
    const unread = Array.from(messagesEl.children).filter(
      (node) => Number(node.dataset.ts || 0) > lastSeenAt
    ).length;
    countEl.textContent = String(unread);
    countEl.classList.toggle("hidden", unread === 0);
    document.title = unread > 0 ? `(${unread}) ${baseDocTitle}` : baseDocTitle;
  }

  function showJoinError(msg) {
    joinError.textContent = msg;
    joinError.classList.remove("hidden");
  }

  function clearJoinError() {
    joinError.textContent = "";
    joinError.classList.add("hidden");
  }

  function getPastelForName(name) {
    let hash = 0;
    const str = String(name || "Gast").toLowerCase();
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
  }

  function renderColorPicker() {
    if (!colorPickerEl) return;
    const activeColor = chosenColor || getPastelForName(authorName);
    colorPickerEl.replaceChildren(
      ...PASTEL_PALETTE.map((hex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `chat-color-dot ${activeColor === hex ? "active" : ""}`;
        btn.style.background = hex;
        btn.title = "Farbe wählen";
        btn.addEventListener("click", () => {
          chosenColor = hex;
          sessionStorage.setItem(COLOR_KEY, hex);
          renderColorPicker();
        });
        return btn;
      })
    );
  }

  function renderAvatarPicker() {
    if (!avatarPickerEl) return;
    avatarPickerEl.replaceChildren(
      ...Object.entries(AVATARS).map(([key, info]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `chat-avatar-btn ${chosenAvatar === key ? "active" : ""}`;
        btn.title = info.label;
        btn.innerHTML = info.svg;
        btn.addEventListener("click", () => {
          chosenAvatar = key;
          renderAvatarPicker();
        });
        return btn;
      })
    );
  }

  function syncParticipantView() {
    authorName = readSavedName();
    if (authorName) {
      joinForm.classList.add("hidden");
      roomEl.classList.remove("hidden");
      currentNameEl.textContent = authorName;
      renderColorPicker();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      roomEl.classList.add("hidden");
      joinForm.classList.remove("hidden");
      renderAvatarPicker();
    }
  }

  function toggleWidget() {
    isOpen = !isOpen;
    widget.classList.toggle("collapsed", !isOpen);
    panel.classList.toggle("hidden", !isOpen);
    bar.setAttribute("aria-expanded", String(isOpen));
    chevron.textContent = isOpen ? "▼" : "▲";
    updateUnreadBadge();
    if (isOpen) {
      syncParticipantView();
      if (authorName) {
        textInput.focus();
      } else {
        joinNameInput.focus();
      }
    }
  }

  function showNotice(msg) {
    if (!noticeEl) return;
    noticeEl.textContent = msg;
    noticeEl.classList.remove("hidden");
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => noticeEl.classList.add("hidden"), 3500);
  }

  function appendFormattedText(container, text) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    let lastIdx = 0;
    for (const match of String(text || "").matchAll(urlRegex)) {
      if (match.index > lastIdx) {
        container.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const a = document.createElement("a");
      a.href = match[0];
      a.textContent = match[0];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      container.appendChild(a);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
  }

  function renderReactionRow(container, msgId, reactionsObj) {
    if (!container) return;
    const reactions = reactionsObj && typeof reactionsObj === "object" ? reactionsObj : {};
    const pills = [];

    for (const emoji of REACTION_EMOJIS) {
      const count = Number(reactions[emoji] || 0);
      if (count <= 0) continue;
      const key = `${msgId}:${emoji}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `chat-react-pill ${reactedMap[key] ? "active" : ""}`;
      btn.textContent = `${emoji} ${count}`;
      btn.addEventListener("click", () => toggleReaction(msgId, emoji));
      pills.push(btn);
    }

    const addWrap = document.createElement("span");
    addWrap.className = "chat-react-add-wrap";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "chat-react-add";
    addBtn.title = "Reagieren";
    addBtn.textContent = "+";

    const menu = document.createElement("span");
    menu.className = "chat-react-menu hidden";
    REACTION_EMOJIS.forEach((emoji) => {
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "chat-react-pick";
      pick.textContent = emoji;
      pick.addEventListener("click", () => {
        menu.classList.add("hidden");
        toggleReaction(msgId, emoji);
      });
      menu.appendChild(pick);
    });

    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    addWrap.append(addBtn, menu);
    container.replaceChildren(...pills, addWrap);
  }

  async function toggleReaction(msgId, emoji) {
    if (!client || !msgId) return;
    const key = `${msgId}:${emoji}`;
    const already = Boolean(reactedMap[key]);
    const delta = already ? -1 : 1;

    try {
      const { data, error } = await client.rpc("chat_react_message", {
        p_room: room,
        p_code: workshopCode || "",
        p_message_id: msgId,
        p_emoji: emoji,
        p_delta: delta,
      });
      if (error) throw error;

      if (already) {
        delete reactedMap[key];
      } else {
        reactedMap[key] = true;
      }
      sessionStorage.setItem(REACTED_KEY, JSON.stringify(reactedMap));

      const node = messagesEl.querySelector(`[data-id="${msgId}"] .chat-reactions`);
      renderReactionRow(node, msgId, data);

      if (channel) {
        await channel.send({
          type: "broadcast",
          event: "reaction_updated",
          payload: { id: msgId, reactions: data },
        });
      }
    } catch (err) {
      showNotice(err.message || "Reaktion fehlgeschlagen");
    }
  }

  function createMessageNode(msg) {
    const item = document.createElement("div");
    item.className = "chat-msg";
    item.dataset.ts = String(new Date(msg.created_at).getTime());
    if (msg.id) item.dataset.id = String(msg.id);
    const bg = msg.color || getPastelForName(msg.author);
    item.style.background = bg;
    item.style.borderColor = "rgba(15, 23, 42, 0.08)";

    const head = document.createElement("div");
    head.className = "chat-msg-head";

    const author = document.createElement("span");
    author.className = "chat-msg-author";

    if (msg.avatar && AVATARS[msg.avatar]) {
      const av = document.createElement("span");
      av.className = "chat-msg-avatar";
      av.innerHTML = AVATARS[msg.avatar].svg;
      author.appendChild(av);
    }

    const authorText = document.createElement("span");
    authorText.textContent = msg.author || "Gast";
    author.appendChild(authorText);

    if (msg.is_admin) {
      const badge = document.createElement("span");
      badge.className = "chat-admin-badge";
      badge.textContent = "Leitung";
      author.appendChild(badge);
    }

    const time = document.createElement("span");
    time.className = "chat-msg-time";
    time.textContent = new Date(msg.created_at).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const bodyRow = document.createElement("div");
    bodyRow.className = "chat-msg-body-row";

    const body = document.createElement("div");
    body.className = "chat-msg-body";
    appendFormattedText(body, msg.content);
    bodyRow.appendChild(body);

    if (isAdminUser && msg.id) {
      const actions = document.createElement("span");
      actions.className = "chat-msg-actions";

      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = "chat-msg-action";
      pinBtn.title = "Anpinnen";
      pinBtn.innerHTML = PIN_SVG;
      pinBtn.addEventListener("click", () =>
        adminPinMessage(`${msg.author}: ${msg.content}`.slice(0, 300))
      );

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "chat-msg-action chat-msg-delete";
      delBtn.title = "Löschen";
      delBtn.innerHTML = TRASH_SVG;
      delBtn.addEventListener("click", () => adminDeleteMessage(msg.id));

      actions.append(pinBtn, delBtn);
      bodyRow.appendChild(actions);
    }

    head.append(author, time);
    item.append(head, bodyRow);

    if (msg.id) {
      const reactionsEl = document.createElement("div");
      reactionsEl.className = "chat-reactions";
      renderReactionRow(reactionsEl, msg.id, msg.reactions);
      item.appendChild(reactionsEl);
    }

    return item;
  }

  function pruneExpiredNodes() {
    const cutoff = Date.now() - MSG_TTL_MS;
    Array.from(messagesEl.children).forEach((node) => {
      if (Number(node.dataset.ts || 0) < cutoff) node.remove();
    });
    updateUnreadBadge();
  }

  function appendSingleMessage(msg) {
    if (!msg) return;
    pruneExpiredNodes();
    messagesEl.appendChild(createMessageNode(msg));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    updateUnreadBadge();
  }

  function renderMessages(rows) {
    const cutoff = Date.now() - MSG_TTL_MS;
    messagesEl.replaceChildren();
    (rows || [])
      .filter((msg) => new Date(msg.created_at).getTime() >= cutoff)
      .forEach((msg) => messagesEl.appendChild(createMessageNode(msg)));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    updateUnreadBadge();
  }

  async function fetchMessages(codeToUse) {
    const { data, error } = await client.rpc("chat_get_messages", {
      p_room: room,
      p_code: codeToUse || "",
    });
    if (error) throw error;
    isAuthorized = true;
    renderMessages(data || []);
  }

  bar.addEventListener("click", toggleWidget);

  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearJoinError();
    const enteredName = joinNameInput.value.trim();
    if (!enteredName) return;

    authorName = enteredName;
    sessionStorage.setItem(NAME_KEY, authorName);
    if (chosenAvatar) {
      sessionStorage.setItem(AVATAR_KEY, chosenAvatar);
    } else {
      sessionStorage.removeItem(AVATAR_KEY);
    }
    syncParticipantView();
    textInput.focus();
  });

  changeNameBtn.addEventListener("click", () => {
    joinNameInput.value = authorName;
    authorName = "";
    sessionStorage.removeItem(NAME_KEY);
    syncParticipantView();
    joinNameInput.focus();
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    authorName = readSavedName();
    if (!authorName) {
      syncParticipantView();
      joinNameInput.focus();
      return;
    }
    if (!client) return;
    const content = textInput.value.trim();
    if (!content) return;

    const now = Date.now();
    if (now - lastSentAt < SEND_COOLDOWN_MS) {
      showNotice("Bitte warte kurz vor der nächsten Nachricht.");
      return;
    }

    sendBtn.disabled = true;
    textInput.value = "";
    try {
      const { data, error } = await client.rpc("chat_send_message", {
        p_room: room,
        p_code: workshopCode || "",
        p_author: authorName,
        p_content: content,
        p_color: chosenColor || getPastelForName(authorName),
        p_avatar: chosenAvatar || "",
      });
      if (error) throw error;

      lastSentAt = Date.now();
      appendSingleMessage(data);

      // Spart DB-Calls: Neue Nachricht direkt per Broadcast senden statt alle Clients neu abfragen zu lassen
      if (channel && data) {
        await channel.send({
          type: "broadcast",
          event: "new_message",
          payload: data,
        });
      }
    } catch (err) {
      textInput.value = content;
      const msg = err.message || "Senden fehlgeschlagen";
      if (msg.includes("Workshop-Code")) {
        isAuthorized = false;
        sessionStorage.removeItem(CODE_KEY);
        workshopCode = "";
        syncParticipantView();
        showJoinError(msg);
      } else {
        showNotice(msg);
      }
    } finally {
      sendBtn.disabled = false;
      textInput.focus();
    }
  });

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(supabaseConfig.url, supabaseConfig.anonKey);

    const { data: sessionData } = await client.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser) {
      const em = (sessionUser.email || "").toLowerCase();
      const gh = (sessionUser.user_metadata?.user_name || "").toLowerCase();
      isAdminUser = em === "zfdc@janboelmann.de" || gh === "zfdcfreiburg";
    }

    const { data: statusData } = await client.rpc("chat_status", { p_room: room });
    codeRequired = Boolean(statusData?.code_required);
    setPinnedMessage(statusData?.pinned_message || "");

    if (!codeRequired || workshopCode) {
      try {
        await fetchMessages(workshopCode);
      } catch {
        isAuthorized = false;
        sessionStorage.removeItem(CODE_KEY);
        workshopCode = "";
      }
    }

    const presenceKey = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
    channel = client
      .channel(`room:${room}`, { config: { presence: { key: presenceKey } } })
      .on("presence", { event: "sync" }, () => {
        if (!presenceEl) return;
        const stateObj = channel.presenceState();
        const total = Object.keys(stateObj).length;
        if (total > 0) {
          presenceEl.textContent = `${total} online`;
          presenceEl.classList.remove("hidden");
        } else {
          presenceEl.classList.add("hidden");
        }
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!codeRequired || isAuthorized) {
          appendSingleMessage(payload);
        }
      })
      .on("broadcast", { event: "pinned_updated" }, ({ payload }) => {
        setPinnedMessage(payload?.text || "");
      })
      .on("broadcast", { event: "clear_all" }, () => {
        messagesEl.replaceChildren();
        updateUnreadBadge();
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const targetId = String(payload?.id || "");
        if (!targetId) return;
        const node = messagesEl.querySelector(`[data-id="${targetId}"]`);
        if (node) {
          node.remove();
          updateUnreadBadge();
        }
      })
      .on("broadcast", { event: "reaction_updated" }, ({ payload }) => {
        const targetId = String(payload?.id || "");
        if (!targetId) return;
        const box = messagesEl.querySelector(`[data-id="${targetId}"] .chat-reactions`);
        if (box) renderReactionRow(box, Number(targetId), payload.reactions);
      })
      .on("broadcast", { event: "files_updated" }, () => {
        if (typeof onFilesUpdated === "function") onFilesUpdated();
      })
      .subscribe(async (status) => {
        const ok = status === "SUBSCRIBED";
        setOnline(ok);
        if (ok) {
          await channel.track({ joined_at: Date.now() });
        }
      });
  } catch (err) {
    console.error("Supabase Chat Fehler:", err);
    setOnline(false);
  }
}
