# 本地开发

## 分支与工具

本地与远程长期保留 `main`、`dev`。默认在 `dev` 开发，先检查状态、fetch origin 并在可快进时同步；不覆盖用户改动，不 reset 或 force-push。验证后本地提交，只有用户明确授权才推送、开 PR、合并或发布。提交使用 Conventional Commits，见 CONTRIBUTING.md。

项目固定 Node 24 / pnpm 10.34.7。Node 用于构建、迁移与隔离测试；线上 API 和后台消费由 Cloudflare Workers 承载。前端为 React/Vite，部署 Pages，图片进入私有 R2，任务传输使用 Queues；没有 Redis/BullMQ 服务。

## 启动

日常开发只需要 Docker Desktop：

```sh
docker compose up --build
# 后续启动：docker compose up
# 后台启动：docker compose up -d
```

打开 `http://localhost:8081`（`http://localhost:5173` 同样可用）。Compose 默认只启动 `studio`：Vite + Wrangler API／Queues 消费者，前端 `/api` 代理到本地 8787。日志会打印 Web 和 API 地址。首次构建安装依赖，后续使用容器缓存。

在根 `.env` 配置 `SUPABASE_PROJECT_REF` 与 `SUPABASE_DATABASE_URL`，格式见 `.env.example`。启动入口校验项目、密码占位符及 TLS 参数，再通过 Wrangler 本地 Hyperdrive 连接配置直连 Supabase。缺少有效连接时启动失败，不回退到 Docker 数据库。连接凭据仅用于服务端，不写入已跟踪配置或前端变量。

**本地与线上共用 Supabase 业务数据**：账号、积分、历史均来自远端库，应用操作也会修改远端数据。启动不自动迁移、不创建账号、不赠送积分。迁移需使用独立的显式命令。

R2、Images 和 Queues 仍为本地模拟，状态保存于 `studio-state` 卷。仅切换数据库不会同步线上 R2 图片，历史图片若不在本地模拟存储中仍无法加载。完整的远端图片访问需另行配置资源服务；不要将此模式视为与线上完全一致的生图环境。本地真实生图默认关闭，`LOCAL_IMAGE_GENERATION_ENABLED` 不应在未配置一致的对象存储和任务传输前开启。

源码绑定挂载，前端热更新，Worker 修改后重建。Linux `node_modules` 使用独立卷；端口 8081、5173、8787 仅发布到本机。Dockerfile 修改后执行 `docker compose up --build`；依赖修改后重启 `studio`。

```sh
docker compose logs -f studio
docker compose restart studio
docker compose stop studio
```

本地 PostgreSQL 仅保留在 `test` profile，默认 `docker compose up` 不启动它。原数据卷保留，不使用 `down -v` 或 `--remove-orphans`。如有已运行的旧 PostgreSQL，可在确认无测试使用时执行 `docker compose stop postgres`。旧前端占用 8081 时先执行 `docker stop lycoboai-web-1`。

宿主机 Node 24 / pnpm 10.34.7 调试（先停止 `studio` 避免端口冲突）：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

宿主机入口同样读取 `.env` 的 Supabase 配置。宿主机 `.wrangler/state` 与 Docker 模拟存储分开。修改端口时同步可信来源和 `DEV_API_PROXY_TARGET`。

## 数据库与测试

`pnpm db:generate` 生成待审查迁移，不访问生产库；`pnpm db:migrate` 必须显式确认 `DATABASE_URL`；Supabase 使用专用 `pnpm db:migrate:supabase`。已合并迁移只追加，禁止 db push 或重写迁移。

```sh
pnpm check
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

集成验证在独立数据库和本地 Cloudflare 模拟中执行；不会使用 Supabase 生产数据或付费模型。日常 UI 全量 E2E 默认留给远程 CI，关键交互按需执行相关文件，详见 [测试说明](testing.md)。

## 发布

同一仓库通过 `pnpm cloudflare:setup` 准备资源、`pnpm cloudflare:deploy` 部署消费者、API 和 Pages。需要账户开通、作用域受限的部署 token 与 Worker Secrets；真实密码不进入配置文件或 Git。完整步骤、费用边界、UID 路径和上线验收见 [Cloudflare 部署](cloudflare-deployment.md)。
