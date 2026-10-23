# 本地开发

## 分支流程

本地与远程必须长期保留 `main`、`dev`。`dev` 合并到 `main` 后仍保留源分支，不使用 `--delete-branch` 删除 `dev`；同步后继续在本地 `dev` 开发。分支清理始终排除 `main`、`dev`，其他本地分支仅在确认已合入或已被替代且用户要求清理时删除。

长期分支为 dev（日常开发）与 main（稳定版本）。默认直接在本地 dev 开发，先检查状态、fetch origin 并在可快进时同步远端；保留本地提交与未提交内容。只有用户明确要求时才新建分支或 worktree。验证后默认只提交本地；推送、创建或更新 dev → main PR、合并和发布均按明确授权执行。提交信息采用 Angular 风格英文 `type(scope): subject`，见 CONTRIBUTING.md。

## 环境

项目固定 Node 24 / pnpm 10.34.7。从根目录执行命令。
pnpm install 的 prepare 会配置此仓库专用 .githooks，不修改用户全局 Git 配置。
如准备提交但未设置作者，请用自己的真实 Git 用户名和邮箱，不使用虚构团队身份。

1. pnpm install --frozen-lockfile
2. 首次将 .env.example 复制为 .env，不覆盖已有配置。
3. pnpm dev：启动 Web 5173、API 8787 与 Worker；是否消费生图队列由独立开关控制。
4. 浏览器打开 http://127.0.0.1:5173。

.env 只由 API/Worker/DB CLI 显式读取；前端不读取整份服务器配置。
Vite 的 /api 默认代理到本地 8787，可通过 DEV_API_PROXY_TARGET 调整；更改 API_PORT 时需同步代理。
本地 preview 仅预览静态产物，不自动代理 API；正式使用网关。

## Compose 开发模式

运行 `docker compose up --build` 可同时启动 Web、API、Worker、PostgreSQL 和 Redis；后续直接 `docker compose up`。
Web 地址为 http://localhost:8080/，API 地址为 http://127.0.0.1:8788/api。
启动日志会打印宿主机可访问的 Web 和 API URL，跟随 `.env` 的 `WEB_PORT`（默认 8080）与 `API_PUBLIC_PORT`（默认 8788）；端口被占用时可在 `.env` 修改后重新运行 Compose。
后台运行使用 `docker compose up -d --build --wait`，通过 `docker compose logs -f web api worker` 跟踪日志。
默认 Web/API 端口与本地 `pnpm dev` 不冲突；同时运行时须保持数据库、队列和图片目录一致。

Web 的 src、public、index.html、vite.config.ts，以及 API 和 contracts 的 src 以只读方式挂载到容器。
修改页面 TSX/CSS 后 Vite 自动热更新；容器启用文件轮询以兼容 Docker Desktop。API 使用 Node watch 自动重启。
依赖在 Linux 镜像内安装，不共享宿主机 node_modules；修改 package.json、pnpm-lock.yaml、构建配置或未挂载目录后运行 `docker compose up --build`。
Vite 在容器内通过 api:8787 代理 /api，本地 pnpm dev 继续使用 127.0.0.1:8787。
DEV_API_PROXY_TARGET 和 DEV_USE_POLLING 仅用于 Vite 开发服务器配置，不作为浏览器环境变量公开。

容器端口只发布到宿主机 127.0.0.1。开发镜像不包含本地 .env；API/Worker 通过 env_file 读取本地配置，Compose 覆盖容器内数据库、Redis 和图片目录。容器数据库优先使用 `IMAGE_COMPOSE_DATABASE_URL`，未配置时连接 Compose PostgreSQL；宿主机 Node 使用 `DATABASE_URL`。切换 Supabase 时两者须配置为相同的目标地址，并重建 API／Worker 容器；当前本地环境已切换，步骤和数据边界见 [Supabase 接入](supabase-postgres.md)。
API 已接入图片上传、任务与素材查询；独立 Worker 消费生图队列。服务监听不等于已配置模型，首次启用需完成迁移、本地身份签发与服务商 key 配置，详见 image-generation-api.md。
Compose 不自动迁移数据库或删除数据卷。仅需基础设施时继续使用 `pnpm infra:up`。

## 可选基础设施

Compose 项目名 lycoboai，PostgreSQL 55432、Redis 56379，仅绑定 127.0.0.1。
必须使用本项目服务，不连接 bonko 的服务，不读取其 .env。
pnpm infra:up 只启动 PostgreSQL/Redis 并等待健康检查；pnpm infra:down 停止此 Compose 项目（含已启动的 Web/API）但不删除卷。
禁止把 docker compose down -v 当作普通清理命令。

数据库：
- pnpm db:generate 根据 schema 生成待审查迁移；不访问生产库。
- pnpm db:migrate 使用显式 DATABASE_URL，执行前检查目标。
- 未合并的迁移冲突先协调作者；已合并迁移只追加，不修改。
- 种子不自动执行，不创建虚拟客户或积分。

Worker：
- 默认 WORKER_ENABLED=false，不连接 Redis。
- 本地基础设施启动后使用 WORKER_ENABLED=true pnpm dev:worker。
- 生图使用独立的 IMAGE_WORKER_ENABLED 与 IMAGE_GENERATION_ENABLED 开关，配置 VAKV_API_KEY 后执行真实模型调用。
- pnpm --filter @lycoboai/api images:setup 初始化本地工作台身份、图片目录与开关；执行前先完成迁移。
- `.env.example` 中生图默认关闭；首次执行 `images:setup` 后，本地 `.env` 的 `IMAGE_GENERATION_ENABLED`、`IMAGE_WORKER_ENABLED` 为 true，后续启动沿用该配置，无需每次设置。不要用示例文件覆盖已配置的 `.env`。Compose 修改环境变量后用 `docker compose up -d --wait api worker web` 重建容器配置，单纯 restart 不会加载新的环境变量。
- `WORKER_ENABLED=false` 只关闭诊断队列，不影响已启用的生图 Worker；`Image worker started` 才是生图消费者启动日志。两个 Worker 均关闭时，Node watch 显示 `Completed running ... Waiting for file changes` 属于等待源码变化，不表示 API 卡死。
- 日志说明 Worker 就绪不代表业务生图就绪。

## 日常命令

pnpm format → pnpm check → UI 有变化时 pnpm test:e2e。
API 单元测试使用 Hono app.request，无需绑定端口或 Docker。
检查生产编译产物：pnpm build，然后分别 pnpm --filter @lycoboai/api start
或配置好 Redis 后 pnpm --filter @lycoboai/worker start。
SIGTERM/SIGINT 触发有界关闭；不要直接丢弃正在执行的付费请求。

## 端口与调试

默认服务只监听 loopback。需要局域网访问时显式配置 API_HOST 与 Vite host。
不要为方便开发取消鉴权/CORS/上传检查；未接入功能应明确禁用。
