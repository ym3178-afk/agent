# Elian Chatbot：GitHub Pages + Firebase + Cloudflare Worker

这个版本不使用 Firebase Cloud Functions，因此 Firebase 可以继续保留在 Spark 免费方案。OpenAI API Key 保存在 Cloudflare Worker 的加密 Secret 中，不会出现在 GitHub 或浏览器代码里。

## 一、创建 Cloudflare Worker（不需要 npm）

1. 登录 Cloudflare Dashboard。
2. 打开 **Workers & Pages**。
3. 点击 **Create → Worker → Deploy**。
4. 进入 Worker 后点击 **Edit code**。
5. 删除默认代码，把 `cloudflare-worker.js` 的全部内容粘贴进去。
6. 点击 **Deploy**。

## 二、添加 OpenAI Secret

1. 打开该 Worker 的 **Settings**。
2. 进入 **Variables and Secrets**。
3. 点击 **Add**。
4. Type 选择 **Secret**。
5. Variable name 填：

   `OPENAI_API_KEY`

6. Value 粘贴一枚全新 OpenAI API Key。
7. 保存并 Deploy。

不要把 Key 写进 `chat-bot.js`，也不要上传 GitHub。之前公开过的 Key 必须删除并重新创建。

## 三、复制 Worker URL

Worker 部署后会得到类似：

`https://elian-chatbot-api.your-account.workers.dev`

在浏览器中打开：

`https://elian-chatbot-api.your-account.workers.dev/chat`

看到 `Method not allowed` 属于正常现象，说明 Worker 在线。

## 四、修改 chat-bot.js

找到：

```js
const WORKER_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/chat";
```

替换为你的真实 URL，例如：

```js
const WORKER_URL = "https://elian-chatbot-api.your-account.workers.dev/chat";
```

必须保留最后的 `/chat`。

## 五、上传 GitHub Pages

把下面三个文件上传到仓库根目录并覆盖旧文件：

- `index.html`
- `style.css`
- `chat-bot.js`

GitHub 仓库中不要再保留 `index (1).html` 或带括号的重复文件。

Pages 设置：

- Source：Deploy from a branch
- Branch：main
- Folder：/(root)

网站地址：

`https://ym3178-afk.github.io/agent/`

## 六、测试

打开网站，按 `Command + Shift + R` 强制刷新，然后发送消息。

浏览器 Console 应显示：

`ELIAN_CHATBOT_VERSION: cloudflare-v1`

## 常见错误

- `Cloudflare Worker URL has not been added`：还没有在 `chat-bot.js` 填真实 Worker URL。
- `OPENAI_API_KEY secret is missing`：Cloudflare 没添加 Secret，或者添加后没有重新 Deploy。
- `invalid_api_key`：Key 无效或已经被撤销。
- `insufficient_quota`：OpenAI API 没有余额。ChatGPT Plus 不包含 API 额度。
- `Origin is not allowed`：确认网站使用 `https://ym3178-afk.github.io/agent/`；若换了 GitHub 用户名，需要修改 Worker 里的 `ALLOWED_ORIGINS`。
