(() => {
  "use strict";

  const BUILD = "github-static-final-20260802";
  const WORKER_STORAGE_KEY = "elian_worker_base_url";
  const LOCAL_MESSAGES_KEY = "elian_local_chat_messages";

  const firebaseConfig = {
    apiKey: "AIzaSyCWvo1GFgQkbWu7ofM0oXVGH-ddFiJSirI",
    authDomain: "elian-s-chatbot.firebaseapp.com",
    databaseURL: "https://elian-s-chatbot-default-rtdb.firebaseio.com",
    projectId: "elian-s-chatbot",
    storageBucket: "elian-s-chatbot.firebasestorage.app",
    messagingSenderId: "494672001048",
    appId: "1:494672001048:web:4066198aaac2c652136b6d",
    measurementId: "G-W3T6NDEYBC"
  };

  const elements = {
    setupPanel: document.getElementById("setup-panel"),
    workerInput: document.getElementById("worker-url-input"),
    saveWorkerButton: document.getElementById("save-worker-button"),
    setupResult: document.getElementById("setup-result"),
    chatMessages: document.getElementById("chat-messages"),
    chatForm: document.getElementById("chat-form"),
    messageInput: document.getElementById("message-input"),
    sendButton: document.getElementById("send-button"),
    clearButton: document.getElementById("clear-button"),
    chatStatus: document.getElementById("chat-status"),
    connectionStatus: document.getElementById("connection-status")
  };

  let workerBaseUrl = "";
  let database = null;
  let messagesRef = null;
  let firebaseAvailable = false;
  let displayedMessageIds = new Set();

  function normalizeWorkerBaseUrl(rawValue) {
    let value = String(rawValue || "").trim();
    if (!value) throw new Error("Paste your Cloudflare Worker URL first.");

    value = value.replace(/\/+$/, "");
    if (value.endsWith("/chat")) value = value.slice(0, -5);

    let parsed;
    try {
      parsed = new URL(value);
    } catch (_) {
      throw new Error("The Worker URL is not valid.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("The Worker URL must begin with https://");
    }

    if (!parsed.hostname.endsWith(".workers.dev")) {
      throw new Error("Use the Cloudflare address ending in .workers.dev");
    }

    if (parsed.pathname !== "/" && parsed.pathname !== "") {
      throw new Error("Paste only the base workers.dev address, with or without /chat.");
    }

    return `${parsed.protocol}//${parsed.host}`;
  }

  function setSetupMessage(message, type = "") {
    elements.setupResult.textContent = message;
    elements.setupResult.className = `setup-result ${type}`.trim();
  }

  async function saveAndTestWorker() {
    elements.saveWorkerButton.disabled = true;
    setSetupMessage("Testing Worker…");

    try {
      const normalized = normalizeWorkerBaseUrl(elements.workerInput.value);
      const response = await fetch(`${normalized}/health`, { method: "GET" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || `Worker health check failed (${response.status}).`);
      }

      workerBaseUrl = normalized;
      localStorage.setItem(WORKER_STORAGE_KEY, normalized);
      elements.workerInput.value = normalized;
      setSetupMessage("Worker connected. You can send messages now.", "success");
      updateChatStatus("Ready to chat");
    } catch (error) {
      setSetupMessage(error.message || "Could not connect to the Worker.", "error");
    } finally {
      elements.saveWorkerButton.disabled = false;
    }
  }

  function readLocalMessages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_MESSAGES_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalMessages(messages) {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages.slice(-100)));
  }

  function localMessageId(message) {
    return `${message.timestamp}-${message.sender}-${message.text}`;
  }

  function renderMessages(messages) {
    elements.chatMessages.innerHTML = "";
    displayedMessageIds = new Set();

    const sorted = [...messages].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    if (!sorted.length) {
      addMessageToDisplay({
        text: "Hello! I'm your AI assistant. Connect your Cloudflare Worker above, then send me a message.",
        sender: "bot",
        timestamp: Date.now()
      });
    } else {
      sorted.forEach(addMessageToDisplay);
    }

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function addMessageToDisplay(message) {
    const safeMessage = {
      text: String(message.text || ""),
      sender: message.sender === "user" ? "user" : "bot",
      timestamp: Number(message.timestamp || Date.now())
    };

    const id = message.id || localMessageId(safeMessage);
    if (displayedMessageIds.has(id)) return;
    displayedMessageIds.add(id);

    const wrapper = document.createElement("div");
    wrapper.className = `message ${safeMessage.sender}-message`;

    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = safeMessage.sender === "user" ? "You" : "AI Assistant";

    const body = document.createElement("span");
    body.textContent = safeMessage.text;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = new Date(safeMessage.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    wrapper.append(label, body, time);
    elements.chatMessages.appendChild(wrapper);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  async function saveMessage(message) {
    const localMessages = readLocalMessages();
    localMessages.push(message);
    writeLocalMessages(localMessages);

    if (firebaseAvailable && messagesRef) {
      try {
        await messagesRef.push({
          text: message.text,
          sender: message.sender,
          timestamp: message.timestamp
        });
        return;
      } catch (error) {
        console.warn("Firebase write failed; kept local copy instead.", error);
        firebaseAvailable = false;
        elements.connectionStatus.textContent = "Local history only";
      }
    }

    addMessageToDisplay(message);
  }

  async function getAIResponse(message) {
    if (!workerBaseUrl) {
      throw new Error("Connect your Cloudflare Worker at the top of the page first.");
    }

    let response;
    try {
      response = await fetch(`${workerBaseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
    } catch (_) {
      throw new Error("Could not reach the Cloudflare Worker. Check the saved workers.dev URL and deployment.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail ? ` ${data.detail}` : "";
      throw new Error(`${data.error || `Backend error (${response.status}).`}${detail}`);
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The Worker returned an empty response.");
    }

    return data.reply.trim();
  }

  function updateChatStatus(text) {
    elements.chatStatus.textContent = text;
  }

  function setSending(isSending) {
    elements.sendButton.disabled = isSending;
    elements.messageInput.disabled = isSending;
    elements.sendButton.textContent = isSending ? "Sending…" : "Send";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const text = elements.messageInput.value.trim();
    if (!text) return;

    setSending(true);
    updateChatStatus("Sending message…");

    try {
      const userMessage = { text, sender: "user", timestamp: Date.now() };
      elements.messageInput.value = "";
      await saveMessage(userMessage);

      updateChatStatus("Getting AI response…");
      const reply = await getAIResponse(text);
      await saveMessage({ text: reply, sender: "bot", timestamp: Date.now() });
      updateChatStatus("Ready to chat");
    } catch (error) {
      updateChatStatus(error.message || "Message failed");
      addMessageToDisplay({
        text: `Error: ${error.message || "The message could not be sent."}`,
        sender: "bot",
        timestamp: Date.now()
      });
    } finally {
      setSending(false);
      elements.messageInput.focus();
    }
  }

  async function clearChat() {
    const confirmed = window.confirm("Clear the chat history shown in this browser and Firebase?");
    if (!confirmed) return;

    localStorage.removeItem(LOCAL_MESSAGES_KEY);
    if (firebaseAvailable && messagesRef) {
      try {
        await messagesRef.remove();
      } catch (error) {
        console.warn("Firebase clear failed.", error);
      }
    }
    renderMessages([]);
    updateChatStatus("Chat cleared");
  }

  function initializeFirebase() {
    if (!window.firebase) {
      elements.connectionStatus.textContent = "Firebase SDK unavailable · local history only";
      renderMessages(readLocalMessages());
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      messagesRef = database.ref("chat/messages");

      database.ref(".info/connected").on("value", (snapshot) => {
        elements.connectionStatus.textContent = snapshot.val() === true
          ? "Firebase connected"
          : "Firebase reconnecting…";
      });

      messagesRef.on(
        "value",
        (snapshot) => {
          firebaseAvailable = true;
          const value = snapshot.val() || {};
          const messages = Object.entries(value).map(([id, item]) => ({ id, ...item }));
          renderMessages(messages.length ? messages : readLocalMessages());
        },
        (error) => {
          console.warn("Firebase read failed; using local history.", error);
          firebaseAvailable = false;
          elements.connectionStatus.textContent = "Local history only";
          renderMessages(readLocalMessages());
        }
      );
    } catch (error) {
      console.warn("Firebase initialization failed; using local history.", error);
      elements.connectionStatus.textContent = "Local history only";
      renderMessages(readLocalMessages());
    }
  }

  workerBaseUrl = localStorage.getItem(WORKER_STORAGE_KEY) || "";
  elements.workerInput.value = workerBaseUrl;
  if (workerBaseUrl) {
    setSetupMessage("A Worker URL is saved in this browser. Click Save & Test to verify it.");
  }

  elements.saveWorkerButton.addEventListener("click", saveAndTestWorker);
  elements.chatForm.addEventListener("submit", handleSubmit);
  elements.clearButton.addEventListener("click", clearChat);

  initializeFirebase();
  elements.messageInput.focus();
  console.log(`ELIAN_CHATBOT_BUILD: ${BUILD}`);
})();
