# 本地开发

线上使用 CloudBase 静态托管、Node HTTP 云函数、Event 消费者、共享 PostgreSQL 和私有云存储。默认入口与发布流程见 [CloudBase 部署](cloudbase-deployment.md)。

本地使用 Node 24、pnpm 10.34.7、独立 PostgreSQL 与私有 S3（SeaweedFS），不使用旧平台模拟器或 Redis 队列。API、任务消费者、图片服务分别为独立 Node 进程，Vite 提供前端；消费者直接认领本地 PG outbox，复用生产任务处理器。

```sh
test -f .env || cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

启动器 `scripts/local/dev.mjs` 固定使用本地业务数据库与存储，过滤线上基础设施凭据，仅按显式开关导入模型配置。生图会产生真实供应商费用；默认关闭。数据库账号创建沿用已有管理脚本，不能将测试账户当作生产账户。

前端 `http://127.0.0.1:5173`，API `http://127.0.0.1:8787`，私有图片 `http://127.0.0.1:8791`。本地签名与 JWT 密钥每次启动随机生成，可信来源仅限配置中的本机地址。

Docker 开发可使用 `docker compose up --build`，对外前端端口8081；首次启动前先完成上述数据库迁移。数据库与图片卷保留，禁止用删除共享卷解决问题。远端凭据、旧迁移备份、历史数据均不由本地启动器修改。

宿主机 `pnpm dev` 与 Docker `studio` 共用 5173、8787、8791 端口，切换前先停止原开发进程。如果提示 `address already in use`，用 `lsof -nP -iTCP:8787 -sTCP:LISTEN` 确认占用者，再停止属于本项目的进程。Docker 启动器为前端选择 `dev:docker`，监听容器的 `0.0.0.0`；容器健康后通过 `http://127.0.0.1:8081` 访问。

日常运行 `pnpm check`。隔离集成和手动浏览器检查见 [测试说明](testing.md)。

2026-11-01 已从 CloudBase 同步业务库到本地 Docker，范围、验证、备份及隔离复制任务后开启本地生图的状态见 [本地数据库同步记录](cloudbase-local-database-sync.md)。
