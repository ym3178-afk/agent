// Elian's Chatbot — secure Firebase + OpenAI front end
// The OpenAI API key is intentionally NOT stored in this browser file.

"use strict";

console.log("ELIAN_CHATBOT_VERSION: secure-v3");

document.addEventListener("DOMContentLoaded", function () {
  const firebaseConfig = {
    apiKey: "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",
    authDomain: "elian-s-chatbot.firebaseapp.com",
    databaseURL: "https://elian-s-chatbot-default-rtdb.firebaseio.com",
    projectId: "elian-s-chatbot",
    storageBucket: "elian-s-chatbot.firebasestorage.app",
    messagingSenderId: "494672001048",
    appId: "1:494672001048:web:4066198aaac2c652136b6d",
    measurementId: "G-W3T6NDEYBC"
  };

  if (!window.firebase) {
    console.error("Firebase SDK did not load.");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const database = firebase.database();
  const chatFunction = firebase
    .app()
    .functions("us-central1")
    .httpsCallable("chat");

  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const chatStatus = document.getElementById("chat-status");
  const connectionStatus = document.getElementById("connection-status");

  if (!chatMessages || !messageInput || !sendButton || !chatStatus || !connectionStatus) {
    console.error("One or more required HTML elements are missing.");
    return;
  }

  const sessionId = getOrCreateSessionId();
  const messagesRef = database
    .ref(`chat/sessions/${sessionId}/messages`)
    .limitToLast(100);

  messagesRef.on(
    "value",
    function (snapshot) {
      const messages = snapshot.val();
      chatMessages.innerHTML = "";

      if (!messages) {
        addMessageToDisplay(
          "Hello! I'm your AI assistant. How can I help you today?",
          "bot",
          Date.now()
        );
        return;
      }

      Object.values(messages)
        .sort(function (a, b) {
          return Number(a.timestamp || 0) - Number(b.timestamp || 0);
        })
        .forEach(function (message) {
          addMessageToDisplay(
            String(message.text || ""),
            message.sender === "user" ? "user" : "bot",
            Number(message.timestamp || Date.now())
          );
        });

      chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    function (error) {
      console.error("Realtime Database read error:", error);
      updateChatStatus("Database read error");
      showError("Could not read chat history. Check Realtime Database rules.");
    }
  );

  sendButton.addEventListener("click", sendMessage);

  messageInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
      return;
    }

    if (message.length > 1000) {
      showError("Please keep the message under 1,000 characters.");
      return;
    }

    setSendButtonState(true);
    updateChatStatus("Getting AI response...");
    messageInput.value = "";

    try {
      const result = await chatFunction({
        message: message,
        sessionId: sessionId
      });

      if (!result || !result.data || typeof result.data.reply !== "string") {
        throw new Error("The server returned an invalid response.");
      }

      updateChatStatus("Ready to chat");
    } catch (error) {
      console.error("Chat function error:", error);
      updateChatStatus("Error");
      showError(formatFunctionError(error));
      messageInput.value = message;
    } finally {
      setSendButtonState(false);
      messageInput.focus();
    }
  }

  function getOrCreateSessionId() {
    const storageKey = "elianChatbotSessionId";
    const existing = localStorage.getItem(storageKey);

    if (existing && /^[a-zA-Z0-9_-]{20,80}$/.test(existing)) {
      return existing;
    }

    let newId;

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      newId = window.crypto.randomUUID().replaceAll("-", "");
    } else {
      newId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
        .toString(36)
        .slice(2)}`;
    }

    localStorage.setItem(storageKey, newId);
    return newId;
  }

  function addMessageToDisplay(text, sender, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.className = sender === "user"
      ? "message user-message"
      : "message bot-message";

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const label = document.createElement("strong");
    label.textContent = sender === "user" ? "You: " : "AI Assistant: ";

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = formatTimestamp(timestamp);

    contentDiv.appendChild(label);
    contentDiv.appendChild(textSpan);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    chatMessages.appendChild(messageDiv);
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setSendButtonState(disabled) {
    sendButton.disabled = disabled;
    sendButton.querySelector("span").textContent = disabled ? "Sending..." : "Send";
    sendButton.style.opacity = disabled ? "0.6" : "1";
  }

  function updateChatStatus(status) {
    chatStatus.textContent = status;
  }

  function formatFunctionError(error) {
    const code = String(error && error.code ? error.code : "");

    if (code.includes("not-found")) {
      return 'Firebase Function "chat" was not found. Deploy the functions folder first.';
    }

    if (code.includes("resource-exhausted")) {
      return "Please wait a moment before sending another message.";
    }

    if (code.includes("invalid-argument")) {
      return "The message was rejected because it was empty or invalid.";
    }

    if (code.includes("internal")) {
      return "The AI service could not respond. Check Firebase Functions logs and OpenAI billing.";
    }

    return error && error.message
      ? error.message
      : "Unable to contact the AI service.";
  }

  function showError(message) {
    const existing = document.querySelector(".runtime-error-message");
    if (existing) {
      existing.remove();
    }

    const errorBox = document.createElement("div");
    errorBox.className = "runtime-error-message";
    errorBox.textContent = message;
    errorBox.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      z-index: 1000;
      max-width: 480px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    document.body.appendChild(errorBox);

    window.setTimeout(function () {
      errorBox.remove();
    }, 10000);
  }

  database.ref(".info/connected").on("value", function (snapshot) {
    const connected = snapshot.val() === true;
    connectionStatus.innerHTML = connected
      ? '<p style="color:#4CAF50;">✅ Connected to Firebase</p>'
      : '<p style="color:#f44336;">❌ Disconnected from Firebase</p>';
  });

  messageInput.focus();
  updateChatStatus("Ready to chat");

  window.testOpenAI = async function () {
    try {
      const result = await chatFunction({
        message: "Reply with exactly: API test successful.",
        sessionId: sessionId
      });
      alert(result.data.reply);
    } catch (error) {
      console.error(error);
      alert(formatFunctionError(error));
    }
  };
});
