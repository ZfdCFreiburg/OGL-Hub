/**
 * Aufklappbares Supabase-Realtime-Chat-Widget unten rechts mit optionalem Workshop-Code.
 * - Zugeklappt: zeigt Online-Status (grüner Punkt), "OGL Chat" und Nachrichtenanzahl.
 * - Aufgeklappt: fragt nach Name (und Workshop-Code, falls im Admin-Panel gesetzt).
 */
export async function initSupabaseChat(
  supabaseConfig,
  initialPortalCode = "",
  onFilesUpdated = null,
  onSessionInvalidated = null,
  defaultLeaderName = ""
) {
  const widget = document.getElementById("chat-widget");
  const bar = document.getElementById("chat-bar");
  const dot = document.getElementById("chat-online-dot");
  const titleEl = document.getElementById("chat-title");
  const presenceEl = document.getElementById("chat-presence");
  const countEl = document.getElementById("chat-count");
  const popoutBtn = document.getElementById("chat-popout-btn");
  const chevron = document.getElementById("chat-chevron");
  const panel = document.getElementById("chat-panel");
  const isStandalone = new URLSearchParams(window.location.search).get("chat") === "1";

  const joinForm = document.getElementById("chat-join-form");
  const joinNameInput = document.getElementById("chat-join-name");
  const avatarPickerEl = document.getElementById("chat-avatar-picker");
  const joinError = document.getElementById("chat-join-error");
  const joinBtn = document.getElementById("chat-join-btn");

  const roomEl = document.getElementById("chat-room");
  const currentNameEl = document.getElementById("chat-current-name");
  const changeNameBtn = document.getElementById("chat-change-name");
  const pinnedEl = document.getElementById("chat-pinned");

  const messagesEl = document.getElementById("chat-messages");
  const scrollBtn = document.getElementById("chat-scroll-btn");
  const typingEl = document.getElementById("chat-typing");
  const noticeEl = document.getElementById("chat-inline-notice");
  const formEl = document.getElementById("chat-form");
  const replyBarEl = document.getElementById("chat-reply-bar");
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
    gamepad: {
      label: "Controller",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="5"/></svg>`,
    },
    rocket: {
      label: "Raumschiff",
      svg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3.5 3.2 5 7 5 11l-5 2-5-2c0-4 1.5-7.8 5-11z"/><circle cx="12" cy="10" r="1.5"/><path d="M7 11l-3 3v3l3-1"/><path d="M17 11l3 3v3l-3-1"/><path d="M10 17l2 4 2-4"/></svg>`,
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
  sessionStorage.removeItem(COLOR_KEY);

  const room = supabaseConfig.roomName || "general";
  let lastSentAt = 0;
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
          chosenAvatar = chosenAvatar === key ? "" : key;
          renderAvatarPicker();
        });
        return btn;
      })
    );
  }

  function resolveLeaderName() {
    const raw = typeof defaultLeaderName === "function" ? defaultLeaderName() : defaultLeaderName;
    return String(raw || "").trim().slice(0, 40);
  }

  function syncParticipantView(allowLeaderAutoFill = true) {
    authorName = readSavedName();
    if (!authorName && isAdminUser && allowLeaderAutoFill) {
      const leader = resolveLeaderName();
      if (leader) {
        authorName = leader;
        sessionStorage.setItem(NAME_KEY, authorName);
      }
    }
    if (authorName) {
      joinForm.classList.add("hidden");
      roomEl.classList.remove("hidden");
      currentNameEl.textContent = authorName;
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

  const TYPING_THROTTLE_MS = 2000;
  const REPLY_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`;

  let replyTarget = null;
  let lastTypingSent = 0;
  const typingUsers = new Map();

  function clearReplyTarget() {
    replyTarget = null;
    if (replyBarEl) {
      replyBarEl.replaceChildren();
      replyBarEl.classList.add("hidden");
    }
  }

  function setReplyTarget(msg) {
    if (!msg?.id || !msg?.author) return;
    replyTarget = {
      id: msg.id,
      author: msg.author,
      preview: String(msg.content || "").slice(0, 80),
    };
    if (!replyBarEl) return;
    const label = document.createElement("span");
    label.className = "chat-reply-text";
    label.textContent = `Antwort an ${replyTarget.author}: ${replyTarget.preview}`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "chat-reply-cancel";
    closeBtn.title = "Antwort abbrechen";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", clearReplyTarget);
    replyBarEl.replaceChildren(label, closeBtn);
    replyBarEl.classList.remove("hidden");
    textInput.focus();
  }

  function renderTypingIndicator() {
    if (!typingEl) return;
    const now = Date.now();
    for (const [name, ts] of typingUsers.entries()) {
      if (now - ts > 3500) typingUsers.delete(name);
    }
    const names = Array.from(typingUsers.keys());
    if (names.length === 0) {
      typingEl.textContent = "";
      typingEl.classList.add("hidden");
    } else if (names.length === 1) {
      typingEl.textContent = `${names[0]} schreibt…`;
      typingEl.classList.remove("hidden");
    } else {
      typingEl.textContent = `${names.slice(0, 2).join(", ")} schreiben…`;
      typingEl.classList.remove("hidden");
    }
  }

  function isNearBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
  }

  messagesEl.addEventListener("scroll", () => {
    if (scrollBtn && isNearBottom()) {
      scrollBtn.classList.add("hidden");
    }
  });

  scrollBtn?.addEventListener("click", () => {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    scrollBtn.classList.add("hidden");
  });

  function appendFormattedText(container, text) {
    const tokenRegex = /(https?:\/\/[^\s<]+)|(@[A-Za-zÄÖÜäöüß0-9_-]{1,30})/g;
    let lastIdx = 0;
    let mentionsSelf = false;
    const selfMention = authorName ? `@${authorName.toLowerCase()}` : "";
    for (const match of String(text || "").matchAll(tokenRegex)) {
      if (match.index > lastIdx) {
        container.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      if (match[1]) {
        const a = document.createElement("a");
        a.href = match[1];
        a.textContent = match[1];
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        container.appendChild(a);
      } else if (match[2]) {
        const span = document.createElement("span");
        span.className = "chat-mention";
        span.textContent = match[2];
        container.appendChild(span);
        if (selfMention && match[2].toLowerCase() === selfMention) {
          mentionsSelf = true;
        }
      }
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    return mentionsSelf;
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

    container.replaceChildren(...pills);
    container.classList.toggle("hidden", pills.length === 0);
  }

  function createReactionTrigger(msgId) {
    const addWrap = document.createElement("span");
    addWrap.className = "chat-react-add-wrap";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "chat-msg-action chat-react-add";
    addBtn.title = "Reagieren";
    addBtn.textContent = "+";

    const menu = document.createElement("span");
    menu.className = "chat-react-menu hidden";
    REACTION_EMOJIS.forEach((emoji) => {
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "chat-react-pick";
      pick.textContent = emoji;
      pick.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.add("hidden");
        toggleReaction(msgId, emoji);
      });
      menu.appendChild(pick);
    });

    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasHidden = menu.classList.contains("hidden");
      messagesEl.querySelectorAll(".chat-react-menu").forEach((m) => m.classList.add("hidden"));
      if (wasHidden) menu.classList.remove("hidden");
    });

    addWrap.append(addBtn, menu);
    return addWrap;
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
    const mentionsSelf = appendFormattedText(body, msg.content);
    if (mentionsSelf && msg.author !== authorName) {
      item.classList.add("chat-msg-mentioned");
    }
    bodyRow.appendChild(body);

    if (msg.id) {
      const actions = document.createElement("span");
      actions.className = "chat-msg-actions";

      const replyBtn = document.createElement("button");
      replyBtn.type = "button";
      replyBtn.className = "chat-msg-action";
      replyBtn.title = "Antworten";
      replyBtn.innerHTML = REPLY_SVG;
      replyBtn.addEventListener("click", () => setReplyTarget(msg));
      actions.appendChild(replyBtn);

      actions.appendChild(createReactionTrigger(msg.id));

      if (isAdminUser) {
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
      }
      bodyRow.appendChild(actions);
    }

    head.append(author, time);
    item.append(head);

    if (msg.reply_to?.author) {
      const quote = document.createElement("button");
      quote.type = "button";
      quote.className = "chat-msg-quote";
      quote.textContent = `↩ ${msg.reply_to.author}: ${msg.reply_to.preview || ""}`;
      quote.addEventListener("click", () => {
        const target = messagesEl.querySelector(`[data-id="${msg.reply_to.id}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      item.appendChild(quote);
    }

    item.append(bodyRow);

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

  function appendSingleMessage(msg, fromRemote = false) {
    if (!msg) return;
    const stickBottom = !fromRemote || isNearBottom();
    pruneExpiredNodes();
    messagesEl.appendChild(createMessageNode(msg));
    if (stickBottom) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      scrollBtn?.classList.add("hidden");
    } else if (scrollBtn) {
      scrollBtn.classList.remove("hidden");
    }
    if (fromRemote && msg.author && msg.author !== authorName) {
      typingUsers.delete(msg.author);
      renderTypingIndicator();
    }
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

  if (!isStandalone) {
    bar.addEventListener("click", toggleWidget);
    bar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleWidget();
      }
    });
  } else {
    toggleWidget();
  }

  popoutBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if ("documentPictureInPicture" in window) {
      try {
        if (window.documentPictureInPicture.window) {
          window.documentPictureInPicture.window.focus();
          return;
        }
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 420,
          height: 640,
        });
        pipWin.document.title = "OGL Chat";
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
          const clone = pipWin.document.createElement("link");
          clone.rel = "stylesheet";
          clone.href = link.href;
          pipWin.document.head.appendChild(clone);
        });
        pipWin.document.body.className = "chat-standalone";
        if (!isOpen) toggleWidget();
        pipWin.document.body.appendChild(widget);
        pipWin.addEventListener("pagehide", () => {
          document.body.appendChild(widget);
        });
        return;
      } catch {
        // Fallback auf normales Popup-Fenster
      }
    }
    window.open(
      "./?chat=1",
      "ogl-chat-window",
      "popup=yes,width=440,height=680,resizable=yes,scrollbars=yes"
    );
  });

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
    syncParticipantView(false);
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
        p_color: getPastelForName(authorName),
        p_avatar: chosenAvatar || "",
        p_reply_to: replyTarget,
      });
      if (error) throw error;

      clearReplyTarget();
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

  textInput.addEventListener("input", () => {
    if (!channel || !authorName || !textInput.value.trim()) return;
    const now = Date.now();
    if (now - lastTypingSent < TYPING_THROTTLE_MS) return;
    lastTypingSent = now;
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { author: authorName },
    });
  });

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(supabaseConfig.url, supabaseConfig.anonKey);

    const { data: sessionData } = await client.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser) {
      const em = (sessionUser.email || "").toLowerCase();
      const gh = (sessionUser.user_metadata?.user_name || "").toLowerCase();
      isAdminUser =
        em === "zfdc@janboelmann.de" ||
        em === "admin@ogl-hub.local" ||
        gh === "zfdcfreiburg";
      syncParticipantView();
    }

    const { data: statusData } = await client.rpc("chat_status", { p_room: room });
    if (statusData && statusData.session_active === false) {
      if (typeof onSessionInvalidated === "function") {
        onSessionInvalidated({ active: false });
      }
      return;
    }
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
          appendSingleMessage(payload, true);
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const who = String(payload?.author || "").trim();
        if (!who || who === authorName) return;
        typingUsers.set(who, Date.now());
        renderTypingIndicator();
        setTimeout(renderTypingIndicator, 3600);
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
      .on("broadcast", { event: "session_updated" }, ({ payload }) => {
        if (typeof onSessionInvalidated === "function") {
          onSessionInvalidated(payload || {});
        }
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
