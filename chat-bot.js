'use strict';

// Public Firebase web configuration. This identifies the Firebase project;
// it is not the OpenAI secret and is expected to be visible in browser code.
const firebaseConfig = {
  apiKey: 'AIzaSyCWvo1GFgQkbWu7ofM0oXVGH-ddFiJSirI',
  authDomain: 'elian-s-chatbot.firebaseapp.com',
  databaseURL: 'https://elian-s-chatbot-default-rtdb.firebaseio.com',
  projectId: 'elian-s-chatbot',
  storageBucket: 'elian-s-chatbot.firebasestorage.app',
  messagingSenderId: '494672001048',
  appId: '1:494672001048:web:4066198aaac2c652136b6d',
  measurementId: 'G-W3T6NDEYBC'
};

// This is the deployed Firebase HTTP function URL. The function itself stores
// the OpenAI API key in Firebase Secret Manager.
const CHAT_API_URL =
  'https://us-central1-elian-s-chatbot.cloudfunctions.net/chatWithAI';

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatStatus = document.getElementById('chat-status');
const connectionStatus = document.getElementById('connection-status');

let databaseConnected = false;
let backendConnected = false;
let requestInProgress = false;

function setSendButtonState(disabled) {
  requestInProgress = disabled;
  sendButton.disabled = disabled;
  sendButton.querySelector('span').textContent = disabled ? 'Sending…' : 'Send';
}

function updateChatStatus(text) {
  chatStatus.textContent = text;
}

function renderConnectionStatus() {
  connectionStatus.replaceChildren(
    createStatusRow('Firebase database', databaseConnected),
    createStatusRow('AI backend', backendConnected)
  );
}

function createStatusRow(label, connected) {
  const row = document.createElement('div');
  row.className = 'connection-row';

  const dot = document.createElement('span');
  dot.className = `connection-dot ${connected ? 'ok' : 'error'}`;

  const text = document.createElement('span');
  text.textContent = `${connected ? 'Connected' : 'Not connected'} — ${label}`;

  row.append(dot, text);
  return row;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / 60000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessageToDisplay(text, sender, timestamp) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'}`;

  const content = document.createElement('div');
  content.className = 'message-content';

  const label = document.createElement('strong');
  label.textContent = sender === 'user' ? 'You:' : 'AI Assistant:';

  content.append(label, document.createTextNode(` ${String(text ?? '')}`));

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = formatTimestamp(timestamp);

  messageDiv.append(content, time);
  chatMessages.appendChild(messageDiv);
}

function showError(message) {
  const existing = document.querySelector('.error-message');
  if (existing) existing.remove();

  const errorBox = document.createElement('div');
  errorBox.className = 'error-message';
  errorBox.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.className = 'error-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close error');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => errorBox.remove());

  errorBox.appendChild(closeButton);
  document.body.appendChild(errorBox);

  window.setTimeout(() => errorBox.remove(), 15000);
}

async function checkBackend() {
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    backendConnected = response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    backendConnected = false;
  }
  renderConnectionStatus();
}

async function callChatBackend(message) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ message }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Backend returned HTTP ${response.status}.`);
    }

    backendConnected = true;
    renderConnectionStatus();
    return data.response;
  } catch (error) {
    backendConnected = false;
    renderConnectionStatus();

    if (error.name === 'AbortError') {
      throw new Error('The AI request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function sendMessage() {
  if (requestInProgress) return;

  const message = messageInput.value.trim();
  if (!message) return;

  setSendButtonState(true);
  updateChatStatus('Getting AI response…');
  messageInput.value = '';

  try {
    await callChatBackend(message);
    updateChatStatus('Ready to chat');
  } catch (error) {
    console.error('Failed to send message:', error);
    updateChatStatus('Message failed');
    messageInput.value = message;
    showError(`Failed to send message.\n\n${error.message || String(error)}`);
  } finally {
    setSendButtonState(false);
    messageInput.focus();
  }
}

// Realtime chat history. Browser clients have read-only access; the Cloud
// Function writes messages with the Firebase Admin SDK.
database.ref('chat/messages').on(
  'value',
  (snapshot) => {
    const messages = snapshot.val() || {};
    chatMessages.replaceChildren();

    const entries = Object.values(messages).sort(
      (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
    );

    if (entries.length === 0) {
      addMessageToDisplay(
        'Hello! I’m your AI assistant. How can I help you today?',
        'bot',
        Date.now()
      );
    } else {
      entries.forEach((message) => {
        addMessageToDisplay(message.text, message.sender, message.timestamp);
      });
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  },
  (error) => {
    console.error('Firebase read failed:', error);
    showError(`Firebase error: ${error.message}`);
  }
);

database.ref('.info/connected').on('value', (snapshot) => {
  databaseConnected = snapshot.val() === true;
  renderConnectionStatus();
  if (databaseConnected && !requestInProgress) {
    updateChatStatus(backendConnected ? 'Ready to chat' : 'Checking AI backend…');
  }
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

renderConnectionStatus();
checkBackend().finally(() => {
  updateChatStatus(backendConnected ? 'Ready to chat' : 'AI backend not deployed');
});
messageInput.focus();
