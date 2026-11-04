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

本地带图视频使用单独的 `VIDEO_REFERENCE_ORIGIN`。将你控制的公网 HTTPS 域名转发到宿主机的 `127.0.0.1:8791`，在 `.env` 填入该域名的 HTTPS 源站后重新启动。隧道或反向代理需要保留对象路径与查询参数，并允许无需登录的签名读取。网页预览仍用本机地址，模型只获得短期签名原图。未配置公网入口时，本地可生成纯文字视频。

Docker 开发可使用 `docker compose up --build`，对外前端端口8081；首次启动前先完成上述数据库迁移。数据库与图片卷保留，禁止用删除共享卷解决问题。远端凭据、旧迁移备份、历史数据均不由本地启动器修改。

宿主机 `pnpm dev` 与 Docker `studio` 共用 5173、8787、8791 端口，切换前先停止原开发进程。如果提示 `address already in use`，用 `lsof -nP -iTCP:8787 -sTCP:LISTEN` 确认占用者，再停止属于本项目的进程。Docker 启动器为前端选择 `dev:docker`，监听容器的 `0.0.0.0`；容器健康后通过 `http://127.0.0.1:8081` 访问。

日常运行 `pnpm check`。隔离集成和手动浏览器检查见 [测试说明](testing.md)。

2026-11-01 已从 CloudBase 同步业务库到本地 Docker，范围、验证、备份及隔离复制任务后开启本地生图的状态见 [本地数据库同步记录](cloudbase-local-database-sync.md)。

## main 自动版本发布

每次合并到 main 后，该提交的 CI 通过才会触发 `.github/workflows/release.yml`，自动创建 `v主版本.次版本.补丁版本` 标签与 GitHub Release，附带更新日志、作者与文件变更附件。CloudBase 自动部署仍由原工作流独立执行；Release 成功不代表部署已完成。

默认基于远端稳定版本标签递增 patch（如 v0.4.0 → v0.4.1）。根 package.json 的 version 作为版本基线；有意将它升到更高的次版本／主版本时优先采用该基线。Release 标签是部署版本标识，不为每次发布额外回写版本提交或修改锁文件。

同一提交重跑会复用已有标签和 Release；不同提交并发通过原子创建标签避让版本冲突，权限等真实错误不会被吞掉。保留手动指定版本和标签触发入口；所有发布都要求提交属于 main 历史且对应 main push CI 成功。完整 E2E 保持手动运行。
