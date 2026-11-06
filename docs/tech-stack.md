# 技术栈与决策

2026-11-06：`dev` 的生产环境统一为 Cloudflare Workers、Queues、Durable Objects、Images 与私有 R2，现有 PostgreSQL 通过 Hyperdrive 访问。已部署到 `lycobo.com`，详见 [Cloudflare 部署](cloudflare-deployment.md)。

## 固定方案

| 层            | 技术                                          | 理由                                    |
| ------------- | --------------------------------------------- | --------------------------------------- |
| 运行时        | Cloudflare Workers；Node.js 24 构建／本地测试 | HTTP 与 Queue 独立调用生命周期          |
| 包管理        | pnpm 10.34.7 workspace                        | 单仓库、固定锁文件、明确包边界          |
| 语言          | TypeScript 5.9.3 strict                       | 与已验证工具链兼容，升级单独评估        |
| 前端          | React 19 + Vite 8                             | 登录后交互工作台采用 CSR                |
| UI            | HeroUI 3 + Tailwind CSS 4 + Tabler icons      | 单一组件系统，遵守 V3 设计              |
| 路由          | React Router                                  | 页面路由与重型功能懒加载                |
| 数据/本地状态 | TanStack Query 5 / Zustand 5                  | 服务端缓存与本地交互状态分离            |
| 画布          | Konva 10 + react-konva 19                     | 图片编辑/排布基础，尚未实现持久画布     |
| API           | Hono 4 + Workers fetch handler                | 轻量路由、中间件与可测试应用工厂        |
| 参数校验      | Zod 4 + Hono zod-validator                    | 共享输入输出契约                        |
| 日志          | Workers 结构化日志；本地 Pino                 | 结构化、脱敏、不打印原始请求内容        |
| 数据          | PostgreSQL 17 + Drizzle ORM / Kit             | 关系约束、可审查迁移、持久任务          |
| 后台          | Cloudflare Queues + PG outbox                 | PostgreSQL outbox、独立消费与 Cron 恢复 |
| 文件          | 私有 R2 + Images binding                      | 按 UID 分目录，原图、预览与缩略图分开   |
| 通知          | Durable Objects + 可休眠 WebSocket            | 主动推送与游标补齐；提示词优化使用 SSE  |
| 检查          | Biome、Vitest、Playwright、commitlint         | 类型之外的规则、行为、浏览器与提交检查  |

精确依赖版本以各 package.json 与 pnpm-lock.yaml 为准，不在此重复维护全部补丁号。
所有直接依赖使用精确版本；更新通过独立 PR，检查 peer dependencies 与运行时。
当前保留经过验证的 TS/Vitest 主版本，不因 registry 出现新主版本自动整体升级。

## SSR

工作台不使用 SSR；画布、上传、任务都是客户端交互。
未来公开官网、价格与案例内容优先静态生成，确需动态首屏再引入 SSR。
不为 SSR 改造已稳定工作的编辑器，也不因此引入 Next.js。
是否面向国内用户不决定渲染方式，资源部署、图片优化、API 延迟更直接影响体验。

## API 与消费者

API 处理授权、查询与短请求。消费者独立运行，等待模型属于外部 I/O；
CPU 密集图片处理另设受控任务，不阻塞 API 事件循环。
首版不混用 Go 后端，不拆一组无必要微服务。
若后续自部署 GPU 推理，推理服务可以独立采用 Python。

## 资源与部署

前端使用 Workers Static Assets；`/api/*` 由同域 Worker 处理，`/images/*` 在鉴权后读取私有 R2。上传暂存后通过 Queue 转换与登记素材，生成任务必须先持久化任务、扣费及 outbox。当前不接视频；Node、Sharp 和 S3 仅供隔离测试与开发。

## 官方资料

- [React + Vite](https://react.dev/learn/build-a-react-app-from-scratch)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [HeroUI](https://heroui.com/en/docs/react/getting-started)
- [Drizzle](https://orm.drizzle.team/docs/overview)
- [Konva React](https://konvajs.org/docs/react/index.html)
