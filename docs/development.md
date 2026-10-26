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

打开 `http://localhost:8081`（`http://localhost:5173` 同样可用）。Compose 启动本地 PostgreSQL 和 `studio` 开发容器；容器安装锁定依赖、应用已有 Drizzle 迁移，再并行启动 Vite 与 Wrangler。Wrangler 同时加载 API 和队列消费者，前端 `/api` 代理到本地 8787。前端启动后日志会打印宿主机可访问的 Web 和 API URL。第一次构建和安装依赖需要等待，后续依赖使用容器卷缓存。

源码绑定挂载，前端热更新，Worker 代码修改后重新构建。Linux 的 `node_modules` 使用独立卷，不覆盖宿主机依赖；R2/Queues 模拟状态保存在 `studio-state` 卷，数据库保存在原 `postgres-data` 卷。端口 8081、5173、8787、55432 仅发布到本机。修改 Dockerfile 后重新执行 `docker compose up --build`；修改依赖后重启 `studio` 会按锁文件安装。

```sh
docker compose logs -f studio
docker compose restart studio
docker compose stop studio postgres
```

开发容器强制使用本地 PostgreSQL，不使用根 `.env` 的生产 `DATABASE_URL`；不自动创建客户、赠送积分或复制线上数据。本地账号需单独配置，线上账号不会自动出现在本地库。本地真实生图需显式配置 `.env` 中的 `LOCAL_IMAGE_GENERATION_ENABLED=true`、`VAKV_API_KEY`，并准备本地账号、余额及模型配置；默认关闭付费生图。Compose 仅传入上述生图相关配置，不注入部署令牌或生产数据库凭证。生成的 `.dev.vars` 仅用于本地且被 Git 忽略。

保留旧容器与数据卷，不执行 `docker compose down -v` 或 `--remove-orphans`。8081 由新的 `studio` 服务提供；升级时若旧 `lycoboai-web-1` 占用该端口，先执行 `docker stop lycoboai-web-1`，保留其容器和数据。旧 Redis／Node 容器不属于当前启动链；停用前检查旧任务，避免中断未完成的付费请求。

也可在宿主机使用 Node 24 / pnpm 10.34.7 调试（先停止 `studio`，避免端口冲突）：

```sh
pnpm install --frozen-lockfile
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

宿主机模式的 Wrangler 状态位于 `.wrangler/state`，与 Docker 模拟存储分开。修改端口时同步可信来源及 Vite `DEV_API_PROXY_TARGET`；Pages 生产仍通过服务绑定访问私有 API Worker。

## 数据库与测试

`pnpm db:generate` 生成待审查迁移，不访问生产库；`pnpm db:migrate` 必须显式确认 `DATABASE_URL`；Supabase 使用专用 `pnpm db:migrate:supabase`。已合并迁移只追加，禁止 db push 或重写迁移。

```sh
pnpm check
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

集成验证在独立数据库和本地 Cloudflare 模拟中执行；不会使用 Supabase 生产数据或付费模型。日常 UI 全量 E2E 默认留给远程 CI，关键交互按需执行相关文件，详见 [测试说明](testing.md)。

## 发布

同一仓库通过 `pnpm cloudflare:setup` 准备资源、`pnpm cloudflare:deploy` 部署消费者、API 和 Pages。需要账户开通、作用域受限的部署 token 与 Worker Secrets；真实密码不进入配置文件或 Git。完整步骤、费用边界、UID 路径和上线验收见 [Cloudflare 部署](cloudflare-deployment.md)。
