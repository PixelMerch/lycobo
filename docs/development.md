# 本地开发

## 环境

项目固定 Node 24 / pnpm 10.34.7。从根目录执行命令。
pnpm install 的 prepare 会配置此仓库专用 .githooks，不修改用户全局 Git 配置。
如准备提交但未设置作者，请用自己的真实 Git 用户名和邮箱，不使用虚构团队身份。

1. pnpm install --frozen-lockfile
2. 首次将 .env.example 复制为 .env，不覆盖已有配置。
3. pnpm dev：启动 Web 5173、API 8787。
4. 浏览器打开 http://127.0.0.1:5173。

.env 只由 API/Worker/DB CLI 显式读取；前端不读取整份服务器配置。
Vite 的 /api 代理固定指向本地 8787；更改 API_PORT 时需同步开发代理或独立配置。
本地 preview 仅预览静态产物，不自动代理 API；正式使用网关。

## 可选基础设施

Compose 项目名 lycoboai，PostgreSQL 55432、Redis 56379，仅绑定 127.0.0.1。
必须使用本项目服务，不连接 bonko 的服务，不读取其 .env。
pnpm infra:up 启动并等待健康检查；pnpm infra:down 停止但不删除卷。
禁止把 docker compose down -v 当作普通清理命令。

数据库：
- pnpm db:generate 根据 schema 生成待审查迁移；不访问生产库。
- pnpm db:migrate 使用显式 DATABASE_URL，执行前检查目标。
- 未合并的迁移冲突先协调作者；已合并迁移只追加，不修改。
- 种子不自动执行，不创建虚拟客户或积分。

Worker：
- 默认 WORKER_ENABLED=false，不连接 Redis。
- 本地基础设施启动后使用 WORKER_ENABLED=true pnpm dev:worker。
- 当前消费者仅支持 healthcheck 诊断队列，不能处理 generation。
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
