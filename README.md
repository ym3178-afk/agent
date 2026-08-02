# Elian's Chatbot — 直接打开修复版 secure-v3

## 先做这件事

不要把这些文件覆盖进旧的杂乱文件夹。请把整个压缩包解压到一个全新的空文件夹。

顶层应当直接看到：

```text
index.html
style.css
chat-bot.js
functions/
firebase.json
.firebaserc
```

右键顶层 `index.html`，选择 **Open with Live Server**。

浏览器按 F12 打开 Console，刷新后必须看到：

```text
ELIAN_CHATBOT_VERSION: secure-v3
```

如果仍然看到 `makeApiCall`，说明浏览器加载的还是旧文件。

## 部署后端

```bash
npm install -g firebase-tools
firebase login
cd elian-chatbot-direct-fixed
cd functions
npm install
cd ..
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,database,hosting
```

使用新创建的 OpenAI API Key。之前公开过的 Key 必须撤销。

## 验证前端版本

在浏览器 Console 运行：

```javascript
fetch('chat-bot.js?v=secure-v3')
  .then(r => r.text())
  .then(t => console.log({
    oldMakeApiCallFound: t.includes('makeApiCall'),
    secureCallableFound: t.includes('httpsCallable')
  }));
```

正确结果：

```text
oldMakeApiCallFound: false
secureCallableFound: true
```
