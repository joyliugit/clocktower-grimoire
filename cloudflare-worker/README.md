# Cloudflare Workers KV 房间后端

这个后端用于支持：

- 房主建房
- 玩家输入房号加入
- 玩家选座
- 房主给已入座玩家单独发角色卡
- 玩家端通过定时轮询获取自己的角色卡

不使用 Durable Objects，不使用 WebSocket。

## 1. 前置条件

- 已注册 Cloudflare 账号
- 本机已安装 Node.js

## 2. 安装依赖

```powershell
cd D:\xrzl\clocktower-grimoire\cloudflare-worker
npm install
```

## 3. 登录 Cloudflare

```powershell
npx wrangler login
```

## 4. 创建 KV 命名空间

生产环境：

```powershell
npx wrangler kv namespace create ROOMS_KV
```

预览 / 本地调试：

```powershell
npx wrangler kv namespace create ROOMS_KV --preview
```

把命令输出里的 `id` 和 `preview_id` 填入 `wrangler.jsonc`：

- `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`
- `REPLACE_WITH_YOUR_KV_PREVIEW_ID`

## 5. 本地调试 Worker

```powershell
npm run dev
```

## 6. 正式部署

```powershell
npm run deploy
```

部署成功后，你会得到一个 Workers 地址，例如：

```text
https://clocktower-grimoire-room-api.your-subdomain.workers.dev
```

## 7. GitHub Pages 前端如何接这个后端

你的 GitHub Pages 页面链接后面加上 `roomApi` 参数即可：

```text
https://你的用户名.github.io/你的仓库名/?roomApi=https://clocktower-grimoire-room-api.your-subdomain.workers.dev
```

前端会自动把这个地址存进本地缓存，后续再次打开同设备页面时可继续使用。

## 8. API 列表

- `POST /api/rooms/create`
- `POST /api/rooms/connect`
- `GET /api/rooms/state?roomCode=...&clientId=...`
- `POST /api/rooms/story-sync`
- `POST /api/rooms/seat`
- `POST /api/rooms/send-card`
- `GET /api/rooms/card?roomCode=...&clientId=...`
- `POST /api/rooms/leave`
- `GET /api/health`

## 9. 说明

- 这个方案是低频同步方案，适合建房、入座、发角色卡。
- 不适合做高频实时游戏状态广播。
- Workers KV 是最终一致性存储，所以同步会有轻微延迟。当前前端轮询间隔约为 2.5-3 秒。
