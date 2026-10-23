# 本地开发

## 分支与工具

本地与远程长期保留 `main`、`dev`。默认在 `dev` 开发，先检查状态、fetch origin 并在可快进时同步；不覆盖用户改动，不 reset 或 force-push。验证后本地提交，只有用户明确授权才推送、开 PR、合并或发布。提交使用 Conventional Commits，见 CONTRIBUTING.md。

项目固定 Node 24 / pnpm 10.34.7。Node 用于构建、迁移与隔离测试；线上 API 和后台消费由 Cloudflare Workers 承载。前端为 React/Vite，部署 Pages，图片进入私有 R2，任务传输使用 Queues；没有 Redis/BullMQ 服务。

## 启动

```sh
pnpm install --frozen-lockfile
# 首次复制 .env.example 为 .env；不覆盖已有文件。
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

浏览器打开 `http://127.0.0.1:5173`，Vite 将 `/api` 代理到本地 Wrangler 8787。`pnpm dev` 同时加载 API 和 Queues 消费者，R2、Images、队列为本地模拟，持久状态在 `.wrangler/state`。`pnpm cloudflare:dev:setup` 为本地 Worker 写入忽略的 `.dev.vars`；前端不读取服务器秘密。

本地 Hyperdrive 指向 loopback PostgreSQL，不把根 `.env` 的 Supabase 管理连接暗中用于测试。开发数据库不自动创建客户或赠送积分。本地真实生成必须显式设置 `LOCAL_IMAGE_GENERATION_ENABLED=true`、provider key，并有已配置账号和余额；默认不开启付费生图。

`compose.yaml` 仅管理本地 PostgreSQL，端口 55432，仅发布到 127.0.0.1。原 PostgreSQL 数据卷保留，不运行 `docker compose down -v`；旧 Redis／Node 容器与卷不能通过 remove-orphans 等清理命令顺手删除。停用旧服务前检查待执行任务和付费请求，按正常信号关闭。

修改端口时同步 Vite 的 `DEV_API_PROXY_TARGET`。预览静态产物不自动代理 API；Pages 生产通过服务绑定访问私有 API Worker，不需要通配 CORS。

## 数据库与测试

`pnpm db:generate` 生成待审查迁移，不访问生产库；`pnpm db:migrate` 必须显式确认 `DATABASE_URL`；Supabase 使用专用 `pnpm db:migrate:supabase`。已合并迁移只追加，禁止 db push 或重写迁移。

```sh
pnpm check
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

集成验证在独立数据库和本地 Cloudflare 模拟中执行；不会使用 Supabase 生产数据或付费模型。日常 UI 全量 E2E 默认留给远程 CI，关键交互按需执行相关文件，详见 [测试说明](testing.md)。

## 发布

同一仓库通过 `pnpm cloudflare:setup` 准备资源、`pnpm cloudflare:deploy` 部署消费者、API 和 Pages。需要账户开通、作用域受限的部署 token 与 Worker Secrets；真实密码不进入配置文件或 Git。完整步骤、费用边界、UID 路径和上线验收见 [Cloudflare 部署](cloudflare-deployment.md)。
