/**
 * Vorbereitetes Supabase-Realtime-Chat-Modul.
 * Wird nur geladen, wenn CONFIG.supabase.enabled === true ist.
 */
export async function initSupabaseChat(supabaseConfig) {
  const drawer = document.getElementById("chat-drawer");
  const toggleBtn = document.getElementById("chat-toggle");
  const closeBtn = document.getElementById("chat-close");
  const titleEl = document.getElementById("chat-title");
  const statusEl = document.getElementById("chat-status");
  const messagesEl = document.getElementById("chat-messages");
  const formEl = document.getElementById("chat-form");
  const authorInput = document.getElementById("chat-author");
  const textInput = document.getElementById("chat-input");

  titleEl.textContent = supabaseConfig.chatTitle || "Team-Chat";
  authorInput.value = localStorage.getItem("ogl-chat-author") || "";

  let initialized = false;
  let client = null;

  toggleBtn.addEventListener("click", async () => {
    drawer.classList.toggle("hidden");
    if (!initialized && !drawer.classList.contains("hidden")) {
      initialized = true;
      await connect();
    }
  });

  closeBtn.addEventListener("click", () => {
    drawer.classList.add("hidden");
  });

  function appendMessage(msg) {
    const item = document.createElement("div");
    item.className = "chat-msg";

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
    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function connect() {
    statusEl.textContent = "Verbinde...";
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      client = createClient(supabaseConfig.url, supabaseConfig.anonKey);

      const { data, error } = await client
        .from(supabaseConfig.tableName)
        .select("*")
        .eq("room", supabaseConfig.roomName)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;

      messagesEl.replaceChildren();
      (data || []).forEach(appendMessage);
      statusEl.textContent = "Live";

      client
        .channel(`room:${supabaseConfig.roomName}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: supabaseConfig.tableName,
            filter: `room=eq.${supabaseConfig.roomName}`,
          },
          (payload) => appendMessage(payload.new)
        )
        .subscribe();
    } catch (err) {
      console.error("Supabase Chat Fehler:", err);
      statusEl.textContent = "Verbindungsfehler";
    }
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!client) return;

    const author = authorInput.value.trim();
    const content = textInput.value.trim();
    if (!author || !content) return;

    localStorage.setItem("ogl-chat-author", author);
    textInput.value = "";

    const { error } = await client.from(supabaseConfig.tableName).insert({
      room: supabaseConfig.roomName,
      author,
      content,
    });

    if (error) {
      statusEl.textContent = "Senden fehlgeschlagen";
    }
  });
}
