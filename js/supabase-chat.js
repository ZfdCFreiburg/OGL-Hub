/**
 * Aufklappbares Supabase-Realtime-Chat-Widget unten rechts mit optionalem Workshop-Code.
 * - Zugeklappt: zeigt Online-Status (grüner Punkt), "OGL Chat" und Nachrichtenanzahl.
 * - Aufgeklappt: fragt nach Name (und Workshop-Code, falls im Admin-Panel gesetzt).
 */
export async function initSupabaseChat(supabaseConfig, initialPortalCode = "") {
  const widget = document.getElementById("chat-widget");
  const bar = document.getElementById("chat-bar");
  const dot = document.getElementById("chat-online-dot");
  const titleEl = document.getElementById("chat-title");
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

  const messagesEl = document.getElementById("chat-messages");
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
  const NAME_TTL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
  const MSG_TTL_MS = 3 * 60 * 60 * 1000; // 3 Stunden
  const SEND_COOLDOWN_MS = 3000;
  const CODE_KEY = "ogl-chat-code";
  const room = supabaseConfig.roomName || "general";
  let lastSentAt = 0;
  let chosenColor = (localStorage.getItem(COLOR_KEY) || "").trim();

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
  let messageCount = 0;
  let isOpen = false;
  let client = null;
  let channel = null;

  titleEl.textContent = supabaseConfig.chatTitle || "OGL Chat";
  widget.classList.remove("hidden");

  function setOnline(isOnline) {
    dot.classList.toggle("online", isOnline);
    dot.title = isOnline ? "Online (Live)" : "Verbinde...";
  }

  function updateCount(n) {
    messageCount = n;
    countEl.textContent = String(messageCount);
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
    if (isOpen) {
      syncParticipantView();
      if (authorName) {
        textInput.focus();
      } else {
        joinNameInput.focus();
      }
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

    const time = document.createElement("span");
    time.textContent = new Date(msg.created_at).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const body = document.createElement("div");
    body.textContent = msg.content;

    head.append(author, time);
    item.append(head, body);
    return item;
  }

  function pruneExpiredNodes() {
    const cutoff = Date.now() - MSG_TTL_MS;
    Array.from(messagesEl.children).forEach((node) => {
      if (Number(node.dataset.ts || 0) < cutoff) node.remove();
    });
    updateCount(messagesEl.children.length);
  }

  function appendSingleMessage(msg) {
    if (!msg) return;
    pruneExpiredNodes();
    messagesEl.appendChild(createMessageNode(msg));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    updateCount(messagesEl.children.length);
  }

  function renderMessages(rows) {
    const cutoff = Date.now() - MSG_TTL_MS;
    messagesEl.replaceChildren();
    (rows || [])
      .filter((msg) => new Date(msg.created_at).getTime() >= cutoff)
      .forEach((msg) => messagesEl.appendChild(createMessageNode(msg)));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    updateCount(messagesEl.children.length);
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
        alert(msg);
      }
    } finally {
      sendBtn.disabled = false;
      textInput.focus();
    }
  });

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(supabaseConfig.url, supabaseConfig.anonKey);

    const { data: statusData } = await client.rpc("chat_status", { p_room: room });
    codeRequired = Boolean(statusData?.code_required);

    if (!codeRequired || workshopCode) {
      try {
        await fetchMessages(workshopCode);
      } catch {
        isAuthorized = false;
        localStorage.removeItem(CODE_KEY);
        workshopCode = "";
      }
    }

    channel = client
      .channel(`room:${room}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!codeRequired || isAuthorized) {
          appendSingleMessage(payload);
        }
      })
      .on("broadcast", { event: "clear_all" }, () => {
        messagesEl.replaceChildren();
        updateCount(0);
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const targetId = String(payload?.id || "");
        if (!targetId) return;
        const node = messagesEl.querySelector(`[data-id="${targetId}"]`);
        if (node) {
          node.remove();
          updateCount(messagesEl.children.length);
        }
      })
      .subscribe((status) => {
        setOnline(status === "SUBSCRIBED");
      });
  } catch (err) {
    console.error("Supabase Chat Fehler:", err);
    setOnline(false);
  }
}
