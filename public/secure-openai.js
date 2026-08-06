// Tutorial 4 frontend: the OpenAI API key never appears in this file.
const firebaseConfig = {
  apiKey: "AIzaSyCWvo1GFgQkbWu7ofM0oXVGH-ddFiJSirI",
  authDomain: "elian-s-chatbot.firebaseapp.com",
  projectId: "elian-s-chatbot",
  storageBucket: "elian-s-chatbot.firebasestorage.app",
  messagingSenderId: "494672001048",
  appId: "1:494672001048:web:4066198aaac2c652136b6d",
  measurementId: "G-W3T6NDEYBC"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
auth.useDeviceLanguage();

// Must match the region used in functions/index.js.
const functions = firebase.app().functions("us-central1");

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const output = document.getElementById("output");

function setBusy(isBusy) {
  userInput.disabled = isBusy || !auth.currentUser;
  sendBtn.disabled = isBusy || !auth.currentUser;
  sendBtn.textContent = isBusy ? "Thinking..." : "Send Message";
}

auth.onAuthStateChanged((user) => {
  if (user) {
    authStatus.textContent = `Authenticated as ${user.email ?? "Google user"}`;
    authStatus.className = "status-indicator status-authenticated";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    setBusy(false);
    output.textContent = "Ready to chat! Type a message and press Send.";
    output.className = "";
    userInput.focus();
  } else {
    authStatus.textContent = "Not authenticated";
    authStatus.className = "status-indicator status-not-authenticated";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInput.disabled = true;
    sendBtn.disabled = true;
    output.textContent = "Please login to start chatting with AI...";
    output.className = "";
  }
});

loginBtn.addEventListener("click", async () => {
  output.textContent = "Opening Google sign-in...";
  output.className = "";

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Login error:", error);
    output.textContent = `Login failed: ${error.message}`;
    output.className = "error";
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout error:", error);
    output.textContent = `Logout failed: ${error.message}`;
    output.className = "error";
  }
});

async function secureChatWithOpenAI(userMessage) {
  const chatWithAI = functions.httpsCallable("chatWithAI");

  try {
    const result = await chatWithAI({ message: userMessage });
    const responseText = result?.data?.response;

    if (typeof responseText !== "string" || !responseText.trim()) {
      throw new Error("The server returned an empty response.");
    }

    return responseText;
  } catch (error) {
    console.error("Firebase callable error:", error);

    const messages = {
      "functions/unauthenticated": "Please log in before sending a message.",
      "functions/invalid-argument": "Please enter a valid message of 500 characters or fewer.",
      "functions/resource-exhausted": "The service is busy or the request limit was reached. Please try again shortly.",
      "functions/deadline-exceeded": "The AI request took too long. Please try again.",
      "functions/unavailable": "The AI service is temporarily unavailable. Please try again shortly."
    };

    throw new Error(messages[error.code] || error.message || "Failed to get an AI response.");
  }
}

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage || !auth.currentUser) return;

  setBusy(true);
  output.textContent = "Thinking...";
  output.className = "";

  try {
    const aiResponse = await secureChatWithOpenAI(userMessage);
    output.textContent = aiResponse;
    output.className = "success";
    userInput.value = "";
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
    output.className = "error";
  } finally {
    setBusy(false);
    userInput.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !sendBtn.disabled) {
    event.preventDefault();
    sendMessage();
  }
});
