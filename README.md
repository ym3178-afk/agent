# Tutorial 4 — Secure OpenAI + Firebase Functions + Firebase Hosting

This package is configured for the Firebase project `elian-s-chatbot`.

## Before deployment

1. In Firebase Console, upgrade the project to the Blaze plan and make sure its Google Cloud Billing account is open.
2. In **Authentication → Sign-in method**, enable **Google**.
3. In **Authentication → Settings → Authorized domains**, make sure these domains are present:
   - `localhost`
   - `elian-s-chatbot.web.app`
   - `elian-s-chatbot.firebaseapp.com`
4. Delete any OpenAI API key that was previously exposed in browser JavaScript or GitHub. Create a new key.

## Deploy

Use Node.js 22, then run these commands from this project folder:

```bash
node -v
firebase --version
firebase login
firebase use elian-s-chatbot

cd functions
npm install
cd ..

firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,hosting
```

When prompted by `firebase functions:secrets:set OPENAI_API_KEY`, paste only the new `sk-...` key. Do not type `Bearer`.

After a successful deployment, open:

- https://elian-s-chatbot.web.app
- https://elian-s-chatbot.firebaseapp.com

## Local test

```bash
firebase emulators:start
```

The frontend calls the callable Cloud Function `chatWithAI`; it never sends an OpenAI API key to the browser.
