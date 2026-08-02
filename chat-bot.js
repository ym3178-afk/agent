(() => {
  "use strict";

  const VERSION = "github-pages-fixed-v4";
  console.log("ELIAN_CHATBOT_VERSION:", VERSION);

  const firebaseConfig = {
    apiKey: "AIzaSyCWvo1GFgQkbWu7ofM0oXVGH-ddFiJSirI",
    authDomain: "elian-s-chatbot.firebaseapp.com",
    projectId: "elian-s-chatbot",
    storageBucket: "elian-s-chatbot.firebasestorage.app",
    messagingSenderId: "494672001048",
    appId: "1:494672001048:web:4066198aaac2c652136b6d"
  };

  const STORAGE_KEY = "elian-chatbot-history-v4";
  const MAX_HISTORY = 30;

  window.addEventListener("DOMContentLoaded", () => {
    const messagesEl = document.getElementById("chat-messages");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("message-input");
    const button = document.getElementById("send-button");
    const chatStatus = document.getElementById("chat-status");
    const connectionStatus = document.getElementById("connection-status");

    if (!window.firebase) {
      connectionStatus.textContent = "Firebase SDK failed to load";
      renderMessage(messagesEl, "error", "Firebase SDK did not load. Refresh the page and check your internet connection.");
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const callChat = firebase.app().functions("us-central1").httpsCallable("chat");
    connectionStatus.textContent = "Firebase client ready";

    let history = loadHistory();
    if (history.length === 0) {
      history.push({ role: "bot", text: "Hello! I’m Elian’s AI assistant. How can I help?", time: Date.now() });
      saveHistory(history);
    }
    renderHistory(messagesEl, history);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || button.disabled) return;

      history.push({ role: "user", text, time: Date.now() });
      history = history.slice(-MAX_HISTORY);
      saveHistory(history);
      renderHistory(messagesEl, history);
      input.value = "";
      button.disabled = true;
      button.textContent = "Sending…";
      chatStatus.textContent = "Waiting for AI…";

      try {
        const result = await callChat({ message: text });
        const reply = result?.data?.reply;
        if (typeof reply !== "string" || !reply.trim()) {
          throw new Error("The function returned an empty response.");
        }
        history.push({ role: "bot", text: reply.trim(), time: Date.now() });
        history = history.slice(-MAX_HISTORY);
        saveHistory(history);
        renderHistory(messagesEl, history);
        chatStatus.textContent = "Ready";
      } catch (error) {
        console.error("Firebase callable error:", error);
        const readable = explainError(error);
        renderMessage(messagesEl, "error", readable);
        chatStatus.textContent = "AI unavailable";
      } finally {
        button.disabled = false;
        button.textContent = "Send";
        input.focus();
      }
    });
  });

  function explainError(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    if (code.includes("not-found")) return "The Firebase function ‘chat’ is not deployed yet.";
    if (code.includes("unauthenticated")) return "Authentication is required by the Firebase function.";
    if (code.includes("resource-exhausted")) return "The OpenAI API quota or rate limit has been reached. Check API billing and limits.";
    if (code.includes("permission-denied")) return "Firebase denied this request. Check the function and project permissions.";
    if (code.includes("internal")) return "The backend received the request but OpenAI could not respond. Check Firebase Functions logs and API billing.";
    if (message.includes("Failed to fetch")) return "The browser could not reach Firebase Functions. Check deployment and network access.";
    return `The AI request failed: ${message || code || "unknown error"}`;
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  }

  function renderHistory(container, history) {
    container.innerHTML = "";
    history.forEach((item) => renderMessage(container, item.role, item.text, item.time));
    container.scrollTop = container.scrollHeight;
  }

  function renderMessage(container, role, text, time = Date.now()) {
    const box = document.createElement("div");
    box.className = `message ${role === "user" ? "user-message" : role === "error" ? "error-message" : "bot-message"}`;

    const content = document.createElement("div");
    content.textContent = text;

    const timestamp = document.createElement("div");
    timestamp.className = "message-time";
    timestamp.textContent = new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    box.append(content, timestamp);
    container.appendChild(box);
    container.scrollTop = container.scrollHeight;
  }
})();
