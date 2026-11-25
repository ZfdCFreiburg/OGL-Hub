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

  const NAME_KEY = "ogl-chat-author";
  const NAME_TIME_KEY = "ogl-chat-author-at";
  const COLOR_KEY = "ogl-chat-color";
  const LAST_SEEN_KEY = "ogl-chat-last-seen";
  const NAME_TTL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
  const MSG_TTL_MS = 3 * 60 * 60 * 1000; // 3 Stunden
  const SEND_COOLDOWN_MS = 3000;
  const CODE_KEY = "ogl-chat-code";
  const room = supabaseConfig.roomName || "general";
  let lastSentAt = 0;
  let chosenColor = (localStorage.getItem(COLOR_KEY) || "").trim();
  let lastSeenAt = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
  let isAdminUser = false;

  function readSavedName() {
    const saved = (localStorage.getItem(NAME_KEY) || "").trim();
    const savedAt = Number(localStorage.getItem(NAME_TIME_KEY) || 0);
    if (!saved || !savedAt || Date.now() - savedAt > NAME_TTL_MS) {
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(NAME_TIME_KEY);
      return "";
    }
    return saved;
  }

  let authorName = readSavedName();
  let workshopCode = (initialPortalCode || localStorage.getItem(CODE_KEY) || "").trim();
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

  function setPinnedMessage(text) {
    const clean = (text || "").trim();
    if (!pinnedEl) return;
    if (clean) {
      pinnedEl.replaceChildren();
      const textWrap = document.createElement("span");
      const pinIcon = document.createElement("span");
      pinIcon.textContent = "📌 ";
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
      localStorage.setItem(LAST_SEEN_KEY, String(lastSeenAt));
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
          localStorage.setItem(COLOR_KEY, hex);
          renderColorPicker();
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
    author.textContent = msg.author || "Gast";

    if (msg.is_admin) {
      const badge = document.createElement("span");
      badge.className = "chat-admin-badge";
      badge.textContent = "Leitung";
      author.append(" ", badge);
    }

    const time = document.createElement("span");
    time.className = "chat-msg-time";
    time.textContent = new Date(msg.created_at).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isAdminUser && msg.id) {
      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = "chat-msg-action";
      pinBtn.title = "Anpinnen";
      pinBtn.textContent = "📌";
      pinBtn.addEventListener("click", () =>
        adminPinMessage(`${msg.author}: ${msg.content}`.slice(0, 300))
      );

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "chat-msg-action";
      delBtn.title = "Löschen";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => adminDeleteMessage(msg.id));

      time.append(pinBtn, delBtn);
    }

    const body = document.createElement("div");
    appendFormattedText(body, msg.content);

    head.append(author, time);
    item.append(head, body);
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
    localStorage.setItem(NAME_KEY, authorName);
    localStorage.setItem(NAME_TIME_KEY, String(Date.now()));
    syncParticipantView();
    textInput.focus();
  });

  changeNameBtn.addEventListener("click", () => {
    joinNameInput.value = authorName;
    authorName = "";
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(NAME_TIME_KEY);
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
        localStorage.removeItem(CODE_KEY);
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
        localStorage.removeItem(CODE_KEY);
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
