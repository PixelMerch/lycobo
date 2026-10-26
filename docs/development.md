# 本地开发

## 分支与工具

本地与远程长期保留 `main`、`dev`。默认在 `dev` 开发，先检查状态、fetch origin 并在可快进时同步；不覆盖用户改动，不 reset 或 force-push。验证后本地提交，只有用户明确授权才推送、开 PR、合并或发布。提交使用 Conventional Commits，见 CONTRIBUTING.md。

项目固定 Node 24 / pnpm 10.34.7。Node 用于构建、迁移与隔离测试；线上 API 和后台消费由 Cloudflare Workers 承载。前端为 React/Vite，部署 Pages，图片进入私有 R2，线上任务传输使用 Queues；本地任务传输使用 Redis Streams，不使用 BullMQ。

## 启动

日常开发只需要 Docker Desktop：

```sh
docker compose up --build
# 后续启动：docker compose up
# 后台启动：docker compose up -d
```

打开 `http://localhost:8081`（`http://localhost:5173` 同样可用）。Compose 启动本地 PostgreSQL、Redis 与 `studio`，自动向本地库应用已有迁移，再运行 Vite + Wrangler API／生图消费者、独立图片资源 Worker 与 Redis 桥接进程。日志会打印 Web、API 和 Assets URL。首次构建安装依赖，后续使用容器缓存。

### 本地与线上隔离

| 服务 | 本地开发位置 | 持久化 |
| --- | --- | --- |
| PostgreSQL | Compose `postgres:5432`；宿主机映射 `127.0.0.1:55432` | `postgres-data` 卷 |
| 图片对象存储 | Wrangler 模拟 R2；原件与缩略图沿用 UID 隔离路径，独立资源入口 `http://cdn.lycobo.localhost:8791` | `studio-state` 卷内 `.wrangler/state` |
| 图片处理 | 本地 Images 模拟 | 输出进入本地 R2 |
| 任务队列 | Compose Redis Streams；宿主机映射 `127.0.0.1:56379` | `redis-data` 卷，AOF 持久化 |

本地数据库、图片、队列均独立，不读取或写入线上 Supabase、R2 或 Queues。不会复制线上账号、积分、历史或图片，也不会自动创建账号和赠送积分。本地已有记录引用的图片若此前存放在其他卷，不能仅凭记录恢复文件。

本地启动只从根 `.env` 读取模型配置白名单：`IMAGE_GENERATION_ENABLED`、`VAKV_ENABLE_IMAGE_EDITS`、`VAKV_API_KEY`、`VAKV_BASE_URL`、`VAKV_CAPABILITY_OVERRIDES`、`GENERATION_TIMEOUT_MS`。启动入口固定本地数据库地址，清除线上基础设施凭据并拒绝 `remote: true` 绑定；`.env` 的 Supabase、数据库、R2、部署令牌、线上 JWT 和 `VITE_*` 值不会被导入开发进程。旧的 `LOCAL_IMAGE_GENERATION_ENABLED` 不再作为用户配置，以 `IMAGE_GENERATION_ENABLED` 为准。

启用本地真实生图时设置 `IMAGE_GENERATION_ENABLED=true` 并配置 `VAKV_API_KEY`；参考图编辑还需 `VAKV_ENABLE_IMAGE_EDITS=true`。关闭时模型 Key 不传入 Worker。修改 `.env` 后执行 `docker compose restart studio`；宿主机模式重启 `pnpm dev`。模型调用会消耗对应供应商账户额度，但账号、积分、任务、图片与队列数据仍保存在本地。根 `.env` 可继续保存部署配置，开发启动不会使用其中的线上数据库。`pnpm cloudflare:deploy`、远端迁移等显式运维命令仍有独立职责，不能作为本地启动命令。

本地队列只保存 `{version, itemId}`。`redis-dev.mjs` 使用消费者组领取消息，心跳续租，执行完成后确认并删除消息；进程退出时未确认消息留在 Redis，租约过期后恢复。单条消息失败最多投递 4 次后进入本地死信流；数据库 outbox 仍是恢复意图的来源，数据库 claim 与不确定结果规则负责避免重复付费提交。桥接每 30 秒触发本地 outbox／租约维护。

为复用同一套 R2/Images 和业务处理，本地入口生成被 Git 忽略的 `apps/{api,worker,assets}/wrangler.local.json`：移除 Cloudflare Queue 绑定及 Cron，使用本地消费者服务绑定和仅监听 `127.0.0.1:8790` 的 Redis HTTP 桥接。内部端点使用每次启动随机生成的令牌，令牌仅进入本地 `.dev.vars`，不进入前端。线上 Wrangler 配置保持 Cloudflare Queues。正常开发使用根 `pnpm dev`／Compose，不重复启动独立消费者。

本地图片通过独立资源 Worker（8791）读取同一个本地 R2，API 只负责授权并返回预览／缩略图／下载签名链接。历史与素材列表批量返回签名链接，上传响应也附带链接，前端直接使用资源地址；旧 `/content` 入口保留为授权后的 302 兼容跳转。资源请求不连接 PostgreSQL，验证签名和来源后读取缓存，未命中再读取本地 R2。签名 30 分钟有效，签名 v2 同时绑定对象、到期时间和图片用途，缓存命中前仍校验签名与精确来源。预览／缩略图路径为 `.preview.webp`／`.thumbnail.webp`；修改预览 URL 的 variant 或文件名不能换取原图。空来源、外域来源和将原图下载 URL 当作图片嵌入均拒绝。下载使用附件响应且不进入浏览器缓存。资源 URL 使用 `variant=preview`（默认，最长边 1600px、WebP quality 82）、`variant=thumbnail`（最长边 512px、WebP quality 76）或 `variant=download`（原始 PNG、attachment）。页面不默认加载原图；未上传的参考文件也先在浏览器生成 WebP 缩略图／预览，原始数据单独保留供上传，后台参考图编辑仍使用原始文件。新图写入时预生成 WebP；历史图片首次缺少某个版本时，从本地原图补生成并缓存，不重新调用模型。资源 Worker 的本地请求日志设为 warn，避免记录带签名的 URL。

本地资源域名与签名密钥由启动器固定／随机生成，忽略 `.env` 中的线上 ASSET 配置；本地域名 `cdn.lycobo.localhost` 解析到本机回环地址；只有开发模式显式允许该域名及精确 loopback HTTP，生产资源 Origin 仍要求 HTTPS。本地模拟独立资源链路，不表示访问 Cloudflare 线上 CDN。修改端口需同步本地资源 Origin 和精确来源白名单。

Redis 健康状态纳入 `studio` 健康检查。Redis 故障时发送失败不会确认数据库 outbox；恢复后由维护任务补投。AOF 每秒同步，异常断电可能丢失最近一秒的传输数据，持久数据库 outbox 负责补偿；不要把 Redis 当作计费或任务状态来源。

源码绑定挂载，前端热更新，Worker 修改后重建。Linux `node_modules` 使用独立卷；端口 8081、5173、8787、8791、55432、56379 仅发布到本机。Dockerfile 修改后执行 `docker compose up --build`；依赖修改后重启 `studio`。

```sh
docker compose logs -f studio
docker compose restart studio
docker compose stop studio postgres redis
```

停止／删除容器不会自动删除上述命名卷；不要执行 `docker compose down -v`。旧前端占用 8081 时先执行 `docker stop lycoboai-web-1`，不顺手删除旧容器、卷或孤立服务。

宿主机 Node 24 / pnpm 10.34.7 调试（先停止 `studio` 避免端口冲突）：

```sh
pnpm install --frozen-lockfile
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

宿主机模式固定连接 loopback PostgreSQL，其 `.wrangler/state` 与 Docker 模拟存储分开。修改端口时同步可信来源和 `DEV_API_PROXY_TARGET`。

## 数据库与测试

`pnpm db:generate` 生成待审查迁移，不访问生产库；`pnpm db:migrate` 必须显式确认 `DATABASE_URL`；Supabase 使用专用 `pnpm db:migrate:supabase`。已合并迁移只追加，禁止 db push 或重写迁移。

```sh
pnpm check
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
ALLOW_LOCAL_INTEGRATION=true pnpm test:redis
```

集成验证在独立数据库和本地 Cloudflare 模拟中执行；不会使用 Supabase 生产数据或付费模型。日常 UI 全量 E2E 默认留给远程 CI，关键交互按需执行相关文件，详见 [测试说明](testing.md)。

## 发布

同一仓库通过 `pnpm cloudflare:setup` 准备资源、`pnpm cloudflare:deploy` 部署消费者、API 和 Pages。需要账户开通、作用域受限的部署 token 与 Worker Secrets；真实密码不进入配置文件或 Git。完整步骤、费用边界、UID 路径和上线验收见 [Cloudflare 部署](cloudflare-deployment.md)。
