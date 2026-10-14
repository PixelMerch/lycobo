# 架构与目录

一个 pnpm workspace 仓库，三个独立应用；前端 CSR，API 与 Worker 长驻 Node.js。
代码同仓不表示进程合并或强制一起发布。

| 路径 | 职责 |
| --- | --- |
| apps/web/src/app | 路由、应用壳、providers |
| apps/web/src/features | 按业务组织页面和局部组件 |
| apps/web/src/lib | 浏览器 API 客户端与工具 |
| apps/web/src/styles | 共享设计 tokens 与全局基础样式 |
| apps/api/src | Hono 入口、应用工厂、配置；后续 feature routers/services |
| apps/worker/src | 队列消费者、生命周期与任务执行 |
| packages/contracts | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖 |
| packages/db | PostgreSQL pool、Drizzle schema、迁移 |
| packages/queue | 队列名、payload、连接配置 |
| packages/generation | 生图服务商接口，当前没有真实适配器 |
| packages/storage | 文件授权/存储接口，当前没有真实适配器 |
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
