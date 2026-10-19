# 架构与目录

一个 pnpm workspace 仓库，三个独立应用；前端 CSR，API 与 Worker 长驻 Node.js。
代码同仓不表示进程合并或强制一起发布。

| 路径 | 职责 |
| --- | --- |
| apps/web/src/app | 路由、应用壳、providers |
| apps/web/src/features/studio | 紫色首页、模型选择层、图片创作工作台与客户端草稿；已删除旧 design 预览目录 |
| apps/web/src/lib | 浏览器 API 客户端与工具 |
| apps/web/src/styles | 共享设计 tokens 与全局基础样式 |
| apps/api/src | Hono 入口、应用工厂、配置与组织隔离的生图 feature API |
| apps/worker/src | 队列消费者、生命周期与任务执行 |
| packages/contracts | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖 |
| packages/db | PostgreSQL pool、Drizzle schema、迁移 |
| packages/queue | 队列名、payload、连接配置 |
| packages/generation | 服务商契约、Vakv 同步生图适配与能力校验（真实渠道待验收） |
| packages/storage | 对象存储契约与私有本地图片存储/校验；签名对象存储待接入 |
| tests/e2e | 浏览器关键路径验收 |
| docs/design | 当前认可的设计参考 |
| .agents/skills | 锁定来源的团队技能快照 |

## 依赖方向

web → contracts。api/worker → 服务包 → db/queue/storage/generation。
contracts 不得反向引用应用或 server-only 包；共享包不得依赖 apps。
业务 feature 内部用直接导入，不建立覆盖整站的大 barrel。
当前 packages 使用 TypeScript 源导出：开发通过 Vite/tsx 消费，
生产 API/Worker 由 tsup 内联 @lycoboai/*，启动 dist 时不依赖 TS 运行器。
这些包 private，不是可直接发布到 npm 的编译 SDK。

## 进程与服务

- API：短请求、身份、授权、参数校验、业务编排。
- Worker：有持久任务托管的后台工作，绝不能依赖浏览器连接。
- PostgreSQL：业务与状态真相。Redis：队列传输/调度。
- 对象存储：图片原件、缩略图、下载包；业务库只保存元数据和对象 key。
- SSE：状态变化信号；断线后按游标/数据库补查。

## 服务端模块约定

新增功能采用 features/<domain>/{routes,service,repository}.ts，按复杂度拆分。
路由不直接包含长 SQL 和计费流程。Repository 明确接收 owner/workspace 范围；
服务端解析身份。不要为三行纯函数制造多层依赖注入或类继承框架。

## 部署

静态前端独立部署，网关将同域名 /api/* 转发 Hono。API 和 Worker 可先在同机不同容器，
后续独立扩容。数据库池按进程管理；池大小 × 副本数必须小于数据库连接预算。
初始化尚未提供生产部署授权、域名绑定或上线认证。

## 生图服务端接入

- apps/api/src/features/images：组织访问令牌鉴权、图片上传/读取、模型能力、任务提交/查询、管理员核对。
- packages/contracts/src/image-generation.ts：独立生图输入契约与公开模型目录；不改变既有任务契约。
- packages/db/src/image-repository.ts：组织、令牌、任务、逐图 outbox 与积分账本持久化。
- packages/generation/src/vakv-provider.ts：Vakv 同步生图、能力开关、尺寸映射与不确定结果分类。
- apps/worker/src/image-worker.ts / image-processor.ts：独立生图队列、投递器、并发执行与租约处理。
- packages/storage/src/image-store.ts：服务端图片解码、去元数据、私有 PNG 文件与实际尺寸/哈希。

接口与当前未接通的生产能力边界见 [生图 API 文档](docs/image-generation-api.md)。
