// ChatGPT Chat Bot - Tutorial JavaScript
// This script demonstrates how to integrate ChatGPT API with Firebase for a simple chat application
// It shows real-time chat functionality with AI responses and message history storage

// SECURITY NOTE: This tutorial exposes the API key in client-side code for learning purposes only.
// In production applications, API keys should be kept secure on the server side.

// Wait for the DOM to be fully loaded before running any code
document.addEventListener('DOMContentLoaded', function() {
  
  // ========================================
  // STEP 1: FIREBASE CONFIGURATION
  // ========================================
  // Firebase configuration object - connects your app to your Firebase project
  // Get these values from your Firebase Console (https://console.firebase.google.com)
  
  const firebaseConfig = {
    apiKey: "your-firebase-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  };

  // Initialize Firebase - connects your app to Firebase services
  firebase.initializeApp(firebaseConfig);

  // Get a reference to the Firebase Realtime Database
  const database = firebase.database();

  // ========================================
  // STEP 2: CHATGPT API CONFIGURATION
  // ========================================
  // ChatGPT API configuration - get an API key from OpenAI
  // Visit: https://platform.openai.com/api-keys to create your API key
  
  const OPENAI_API_KEY = 'your-openai-api-key-here';
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  
  // Rate limiting configuration
  let lastApiCall = 0;
  const MIN_CALL_INTERVAL = 1000; // Minimum 1 second between calls

  // ========================================
  // STEP 3: GET REFERENCES TO HTML ELEMENTS
  // ========================================
  // Get references to the HTML elements we want to interact with
  
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatStatus = document.getElementById('chat-status');
  const connectionStatus = document.getElementById('connection-status');

  // ========================================
  // STEP 4: SET UP REAL-TIME DATABASE LISTENERS
  // ========================================
  // Listen for changes to the chat messages in the database
  // This function runs every time a new message is added to Firebase
  
  database.ref('chat/messages').on('value', function(snapshot) {
    const messages = snapshot.val() || {};
    
    // Clear the current chat display
    chatMessages.innerHTML = '';
    
    // Add each message to the chat display
    Object.keys(messages).forEach(function(messageId) {
      const message = messages[messageId];
      addMessageToDisplay(message.text, message.sender, message.timestamp);
    });
    
    // Scroll to the bottom to show the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('Chat messages updated:', messages);
  });

  // ========================================
  // STEP 5: SET UP INPUT EVENT LISTENERS
  // ========================================
  // Handle Enter key press in the input field
  messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Handle Send button clicks
  sendButton.addEventListener('click', function() {
    sendMessage();
  });
  
  // Disable send button during processing to prevent multiple rapid requests
  function setSendButtonState(disabled) {
    sendButton.disabled = disabled;
    if (disabled) {
      sendButton.textContent = 'Sending...';
      sendButton.style.opacity = '0.6';
    } else {
      sendButton.textContent = 'Send';
      sendButton.style.opacity = '1';
    }
  }

  // ========================================
  // STEP 6: MESSAGE SENDING FUNCTION
  // ========================================
  // This function handles the entire process of sending a message and getting an AI response
  
  async function sendMessage() {
    const messageText = messageInput.value.trim();
    
    if (!messageText) {
      return; // Don't send empty messages
    }
    
    setSendButtonState(true);
    updateChatStatus('Sending message...');
    
    try {
      // Step 1: Save the user message to Firebase
      await saveMessageToFirebase(messageText, 'user');
      
      // Clear the input field
      messageInput.value = '';
      
      // Step 2: Get AI response from ChatGPT
      updateChatStatus('Getting AI response...');
      const aiResponse = await getChatGPTResponse(messageText);
      
      // Step 3: Save the AI response to Firebase
      await saveMessageToFirebase(aiResponse, 'bot');
      
      updateChatStatus('Ready to chat');
      
    } catch (error) {
      console.error('Error sending message:', error);
      updateChatStatus('Error: ' + error.message);
      
      let errorDetails = 'Failed to send message.\n\n';
      errorDetails += 'Error Type: ' + error.name + '\n';
      errorDetails += 'Error Message: ' + error.message + '\n';
      
      if (error.stack) {
        errorDetails += '\nStack Trace:\n' + error.stack;
      }
      
      showError(errorDetails);
    } finally {
      setSendButtonState(false);
    }
  }

  // ========================================
  // STEP 7: FIREBASE FUNCTIONS
  // ========================================
  // Save a message to the Firebase database
  
  async function saveMessageToFirebase(text, sender) {
    const message = {
      text: text,
      sender: sender,
      timestamp: Date.now()
    };
    
    await database.ref('chat/messages').push(message);
    console.log('Message saved to Firebase:', message);
  }

  // ========================================
  // STEP 8: CHATGPT API FUNCTIONS
  // ========================================
  // Send a message to ChatGPT API and get a response
  
  async function getChatGPTResponse(userMessage) {
    // Rate limiting: Ensure minimum time between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    
    if (timeSinceLastCall < MIN_CALL_INTERVAL) {
      const waitTime = MIN_CALL_INTERVAL - timeSinceLastCall;
      console.log(`Rate limiting: Waiting ${waitTime}ms before next API call`);
      updateChatStatus(`Rate limiting: Waiting ${Math.ceil(waitTime/1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastApiCall = Date.now();
    
    // Retry configuration
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        return await makeApiCall(userMessage);
      } catch (error) {
        retryCount++;
        
        if (error.message.includes('429') && retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Rate limit hit, retrying in ${waitTime/1000}s (attempt ${retryCount}/${maxRetries})`);
          updateChatStatus(`Rate limited. Retrying in ${waitTime/1000}s... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw error;
      }
    }
  }
  
  // Make the actual API call to ChatGPT
  
  async function makeApiCall(userMessage) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
      throw new Error('Please set your OpenAI API key. Get one from https://platform.openai.com/api-keys');
    }
    
    // Prepare the request to ChatGPT API
    const requestBody = {
      model: "gpt-3.5-turbo", // Using a valid model name
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant. Keep your responses concise and friendly."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    };

    try {
      console.log('=== CHATGPT API REQUEST DEBUG ===');
      console.log('API URL:', OPENAI_API_URL);
      console.log('API Key (first 10 chars):', OPENAI_API_KEY.substring(0, 10) + '...');
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      };
      
      console.log('Request headers:', headers);
      
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      console.log('=== CHATGPT API RESPONSE DEBUG ===');
      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.text();
          errorText = errorData;
        } catch (e) {
          errorText = 'Could not read error response';
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
      }

      const data = await response.json();
      console.log('ChatGPT API response:', data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error(`Unexpected API response structure: ${JSON.stringify(data)}`);
      }
      
      const aiResponse = data.choices[0].message.content;
      console.log('ChatGPT response text:', aiResponse);
      return aiResponse;
      
    } catch (error) {
      console.error('Error calling ChatGPT API:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Could not connect to ChatGPT API. Check your internet connection.');
      } else if (error.message.includes('401')) {
        throw new Error('Authentication error: Invalid API key. Please check your OpenAI API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded. Please wait 1-2 minutes before trying again.');
      } else if (error.message.includes('500')) {
        throw new Error('Server error: ChatGPT API is experiencing issues. Please try again later.');
      } else {
        throw new Error(`ChatGPT API error: ${error.message}`);
      }
    }
  }

  // ========================================
  // STEP 9: UI HELPER FUNCTIONS
  // ========================================
  // Add a message to the chat display
  
  function addMessageToDisplay(text, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const timeString = formatTimestamp(timestamp);
    
    messageDiv.innerHTML = `
      <div class="message-content">
        <strong>${sender === 'user' ? 'You:' : 'AI Assistant:'}</strong> ${text}
      </div>
      <div class="message-time">${timeString}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
  }

  // Convert a timestamp to a readable time string
  
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Update the chat status display
  
  function updateChatStatus(status) {
    chatStatus.textContent = status;
  }

  // Show an error message if something goes wrong
  
  function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    
    error.innerHTML = `<pre style="margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 12px;">${message}</pre>`;
    
    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1000;
      max-width: 500px;
      max-height: 400px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 2px solid #d32f2f;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    closeButton.onclick = function() {
      if (error.parentNode) {
        error.parentNode.removeChild(error);
      }
    };
    
    error.appendChild(closeButton);
    document.body.appendChild(error);
    
    setTimeout(function() {
      if (error.parentNode) {
        error.parentNode.removeChild(error);
      }
    }, 15000);
  }

  // ========================================
  // STEP 10: CONNECTION STATUS MONITORING
  // ========================================
  // Listen for connection state changes
  
  database.ref('.info/connected').on('value', function(snapshot) {
    const connected = snapshot.val();
    
    if (connected) {
      connectionStatus.innerHTML = '<p style="color: #4CAF50;">✅ Connected to Firebase</p>';
      console.log('Connected to Firebase');
    } else {
      connectionStatus.innerHTML = '<p style="color: #f44336;">❌ Disconnected from Firebase</p>';
      console.log('Disconnected from Firebase');
    }
  });

  // ========================================
  // STEP 11: INITIALIZATION
  // ========================================
  // Set up initial state when the page loads
  
  messageInput.focus();
  updateChatStatus('Ready to chat');

  console.log('ChatGPT Chat Bot initialized successfully!');
  
  // Add a test function to the global scope for debugging
  window.testOpenAI = async function() {
    console.log('=== TESTING OPENAI API ===');
    try {
      const testMessage = 'Hello, this is a test message.';
      const response = await getChatGPTResponse(testMessage);
      console.log('✅ API Test Successful!');
      console.log('Response:', response);
      alert('API Test Successful! Check console for details.');
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      alert('API Test Failed! Check console for details.');
    }
  };
  
  console.log('💡 To test your API setup, run: testOpenAI() in the console');
}); 