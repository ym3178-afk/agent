# Elian Chatbot：GitHub Pages 可打开版

## A. 上传 GitHub 的文件

把以下文件直接放到仓库 `main` 分支的根目录：

- `index.html`
- `style.css`
- `chat-bot.js`
- `.nojekyll`

不要改名，尤其首页必须准确叫 `index.html`。

GitHub 仓库：Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save。

网页地址：`https://ym3178-afk.github.io/agent/`

## B. 部署 AI 后端

GitHub Pages 只能托管静态页面。AI 必须由 Firebase Functions 调用。

在整个项目目录运行：

```bash
npm install -g firebase-tools
firebase login
firebase use elian-s-chatbot
cd functions
npm install
cd ..
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:chat
```

Secret 提示出现后，粘贴一枚全新的 OpenAI API Key。不要把 Key 写入 `chat-bot.js`，也不要上传到 GitHub。

## C. 检查

打开网页，按 F12，在 Console 应看到：

`ELIAN_CHATBOT_VERSION: github-pages-fixed-v4`

页面能打开但 AI 不回复时，运行：

```bash
firebase functions:log --only chat
```
