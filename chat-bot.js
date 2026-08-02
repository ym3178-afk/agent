// GitHub Pages frontend + Firebase Realtime Database + Cloudflare Worker backend.
// Never place an OpenAI API key in this file.

document.addEventListener("DOMContentLoaded", () => {
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

  // Replace this once with your deployed Cloudflare Worker URL.
  // Keep /chat at the end.
  const WORKER_URL = "https://elian-s-chatbot-default-rtdb.firebaseio.com/";

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const database = firebase.database();
  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const chatStatus = document.getElementById("chat-status");
  const connectionStatus = document.getElementById("connection-status");

  if (!chatMessages || !messageInput || !sendButton || !chatStatus || !connectionStatus) {
    console.error("Required HTML elements are missing.");
    return;
  }

  const messagesRef = database.ref("chat/messages");

  messagesRef.on(
    "value",
    (snapshot) => {
      const messages = snapshot.val() || {};
      chatMessages.innerHTML = "";

      Object.values(messages)
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
        .forEach((message) => {
          addMessageToDisplay(
            String(message.text || ""),
            message.sender === "user" ? "user" : "bot",
            Number(message.timestamp || Date.now())
          );
        });

      if (!Object.keys(messages).length) {
        addMessageToDisplay(
          "Hello! I'm your AI assistant. How can I help you today?",
          "bot",
          Date.now()
        );
      }

      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    (error) => {
      console.error("Firebase read error:", error);
      updateChatStatus("Firebase database error");
      showError("Firebase could not load the chat history. Check Realtime Database rules.");
    }
  );

  sendButton.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    if (WORKER_URL.includes("YOUR-WORKER")) {
      showError("Cloudflare Worker URL has not been added to chat-bot.js yet.");
      return;
    }

    setSendButtonState(true);
    updateChatStatus("Sending message...");

    try {
      await saveMessageToFirebase(messageText, "user");
      messageInput.value = "";

      updateChatStatus("Getting AI response...");
      const aiResponse = await getAIResponse(messageText);

      await saveMessageToFirebase(aiResponse, "bot");
      updateChatStatus("Ready to chat");
    } catch (error) {
      console.error("Send error:", error);
      updateChatStatus("Error");
      showError(error.message || "The message could not be sent.");
    } finally {
      setSendButtonState(false);
      messageInput.focus();
    }
  }

  async function saveMessageToFirebase(text, sender) {
    await messagesRef.push({
      text: String(text),
      sender,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function getAIResponse(message) {
    let response;

    try {
      response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
    } catch (error) {
      throw new Error("Could not reach the Cloudflare Worker. Check its URL and deployment.");
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // Keep the fallback error below.
    }

    if (!response.ok) {
      const detail = data.detail ? ` ${data.detail}` : "";
      throw new Error((data.error || `Backend error (${response.status}).`) + detail);
    }

    if (!data.reply || typeof data.reply !== "string") {
      throw new Error("The backend returned an empty AI response.");
    }

    return data.reply.trim();
  }

  function addMessageToDisplay(text, sender, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const content = document.createElement("div");
    content.className = "message-content";

    const label = document.createElement("strong");
    label.textContent = sender === "user" ? "You: " : "AI Assistant: ";

    const body = document.createElement("span");
    body.textContent = text;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTimestamp(timestamp);

    content.append(label, body);
    messageDiv.append(content, time);
    chatMessages.appendChild(messageDiv);
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";

    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function setSendButtonState(disabled) {
    sendButton.disabled = disabled;
    sendButton.textContent = disabled ? "Sending..." : "Send";
    sendButton.style.opacity = disabled ? "0.6" : "1";
  }

  function updateChatStatus(text) {
    chatStatus.textContent = text;
  }

  function showError(message) {
    const box = document.createElement("div");
    box.className = "error-message";
    box.textContent = message;
    box.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.45;
      z-index: 1000;
      max-width: 520px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 12000);
  }

  database.ref(".info/connected").on("value", (snapshot) => {
    const connected = snapshot.val() === true;
    connectionStatus.textContent = connected
      ? "✅ Connected to Firebase"
      : "❌ Disconnected from Firebase";
    connectionStatus.style.color = connected ? "#4CAF50" : "#f44336";
  });

  messageInput.focus();
  updateChatStatus("Ready to chat");
  console.log("ELIAN_CHATBOT_VERSION: cloudflare-v1");
});
