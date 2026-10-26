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

打开 `http://localhost:8081`（`http://localhost:5173` 同样可用）。Compose 启动本地 PostgreSQL 与 `studio`，自动向本地库应用已有迁移，再运行 Vite + Wrangler API／Queues 消费者。日志会打印 Web 和 API URL。首次构建安装依赖，后续使用容器缓存。

### 本地与线上隔离

| 服务 | 本地开发位置 | 持久化 |
| --- | --- | --- |
| PostgreSQL | Compose `postgres:5432`；宿主机映射 `127.0.0.1:55432` | `postgres-data` 卷 |
| 图片对象存储 | Wrangler 模拟 R2；原件与缩略图沿用 UID 隔离路径 | `studio-state` 卷内 `.wrangler/state` |
| 图片处理 | 本地 Images 模拟 | 输出进入本地 R2 |
| 任务队列 | Wrangler 模拟 Cloudflare Queues | `studio-state` 卷 |

本地数据库、图片、队列均独立，不读取或写入线上 Supabase、R2 或 Queues。不会复制线上账号、积分、历史或图片，也不会自动创建账号和赠送积分。本地已有记录引用的图片若此前存放在其他卷，不能仅凭记录恢复文件。

`pnpm dev` 不读取根 `.env` 的生产配置；Docker 也不注入 Supabase、Cloudflare 部署令牌或模型密钥。启动入口固定本地数据库地址，清除继承的生产凭据，拒绝 `remote: true` 绑定，关闭真实付费生图。根 `.env` 可继续保存部署配置，开发启动不会使用其中的线上数据库。`pnpm cloudflare:deploy`、远端迁移等显式运维命令仍有独立职责，不能作为本地启动命令。

源码绑定挂载，前端热更新，Worker 修改后重建。Linux `node_modules` 使用独立卷；端口 8081、5173、8787、55432 仅发布到本机。Dockerfile 修改后执行 `docker compose up --build`；依赖修改后重启 `studio`。

```sh
docker compose logs -f studio
docker compose restart studio
docker compose stop studio postgres
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
```

集成验证在独立数据库和本地 Cloudflare 模拟中执行；不会使用 Supabase 生产数据或付费模型。日常 UI 全量 E2E 默认留给远程 CI，关键交互按需执行相关文件，详见 [测试说明](testing.md)。

## 发布

同一仓库通过 `pnpm cloudflare:setup` 准备资源、`pnpm cloudflare:deploy` 部署消费者、API 和 Pages。需要账户开通、作用域受限的部署 token 与 Worker Secrets；真实密码不进入配置文件或 Git。完整步骤、费用边界、UID 路径和上线验收见 [Cloudflare 部署](cloudflare-deployment.md)。
