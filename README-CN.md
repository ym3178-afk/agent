# Elian Chatbot：GitHub Pages 静态网址版本

这个文件夹可以直接上传到 GitHub 仓库根目录。网页本身是纯静态文件；OpenAI API Key 不会放进 GitHub，而是保存在 Cloudflare Worker 的 Secret 中。

## 文件

- `index.html`：GitHub Pages 首页
- `style.css`：页面样式
- `app.js`：聊天逻辑、Firebase 和 Worker 连接
- `cloudflare-worker.js`：Cloudflare 后端代码，不要当作网页脚本加载
- `.nojekyll`：避免 GitHub Pages 进行不必要的 Jekyll 处理

## 1. 上传 GitHub

把这些文件放到仓库根目录：

- `index.html`
- `style.css`
- `app.js`
- `.nojekyll`

仓库中不要保留多个带括号的 `index` 或 `chat-bot` 文件。

GitHub 设置：

- Settings → Pages
- Source：Deploy from a branch
- Branch：main
- Folder：/(root)

网站地址：

`https://ym3178-afk.github.io/agent/`

## 2. 部署 Cloudflare Worker

1. Cloudflare Dashboard → Workers & Pages → Create。
2. 新建 Worker，打开 Edit code。
3. 删除默认代码，粘贴 `cloudflare-worker.js` 的全部内容。
4. 点击 Deploy。
5. Settings → Variables and Secrets → Add。
6. 类型选择 Secret，名称填写 `OPENAI_API_KEY`，值填写一枚全新的 OpenAI API Key。
7. 保存并重新 Deploy。

## 3. 在网页里连接 Worker

不需要修改 `app.js`。

打开 GitHub Pages 后，在顶部输入框粘贴：

`https://你的Worker名称.你的子域名.workers.dev`

点击 **Save & Test**。网页会自动测试 `/health`，并把地址保存在当前浏览器的 localStorage 中。

## 4. 重要安全说明

- 不要把 OpenAI API Key 写进 `app.js`。
- 不要把 OpenAI API Key 上传到 GitHub。
- 任何曾经出现在 GitHub 或聊天截图中的旧 Key 都应撤销，并创建新 Key。
- Firebase Web 配置不是 OpenAI Secret，可以出现在前端；但 Realtime Database Rules 仍需限制滥用。

## 5. 检查版本

页面底部应显示：

`Build: github-static-final-20260802`

浏览器 Console 应显示：

`ELIAN_CHATBOT_BUILD: github-static-final-20260802`
