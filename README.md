# GitHub Pages + Firebase + OpenAI Chat

This folder is prepared for the existing site:

`https://ym3178-afk.github.io/agent/`

The root files (`index.html`, `style.css`, and `chat-bot.js`) are the GitHub Pages frontend. The `functions/` folder is the Firebase backend that securely calls OpenAI.

## Important first step

Delete every OpenAI API key that was previously placed in `chat-bot.js` or uploaded to GitHub. Create a new key for the Firebase secret.

## 1. Install Node.js

Install the current Node.js LTS release. Then open a new Terminal window and verify:

```bash
node -v
npm -v
```

## 2. Install and sign in to Firebase CLI

Run from Terminal:

```bash
npm install -g firebase-tools
firebase login
```

## 3. Install backend packages

Open Terminal in this project folder and run:

```bash
cd functions
npm install
cd ..
```

## 4. Store the new OpenAI key securely

From the project root, run:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Paste only the new `sk-...` key when prompted. Do not write `Bearer` and do not place the key in a JavaScript file.

## 5. Deploy the backend and database rules

The Firebase project must support Cloud Functions deployment. Run:

```bash
firebase deploy --only functions,database
```

The frontend is already configured to call:

`https://us-central1-elian-s-chatbot.cloudfunctions.net/chatWithAI`

## 6. Upload to GitHub

Upload the complete contents of this folder to the root of the GitHub repository used by the `agent` site. These filenames must remain exact:

```text
index.html
style.css
chat-bot.js
```

In GitHub, confirm:

```text
Settings → Pages → Deploy from a branch → main → /root
```

After GitHub finishes deploying, open:

`https://ym3178-afk.github.io/agent/`

The page should display both:

```text
Connected — Firebase database
Connected — AI backend
```

## Notes

- GitHub Pages serves only the public frontend.
- Firebase Cloud Functions runs the private backend.
- Firebase Secret Manager stores the OpenAI key.
- The demo allows 20 AI requests per hour per network.
- Chat history is publicly readable on this class demo. Do not submit private information.
