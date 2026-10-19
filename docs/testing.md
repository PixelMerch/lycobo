# 测试与验收

## 自动检查

- pnpm lint：Biome + 浏览器/server-only 边界检查。
- pnpm typecheck：所有 workspace 包 strict TypeScript。
- pnpm test：契约、API、Worker 的单元行为。
- pnpm build：实际前端和两个 Node 应用生产构建。
- pnpm test:e2e：真实 Chromium 下接口连接、路由、禁用态与窄屏溢出。
- pnpm test:integration：明确 opt-in 的本地 PostgreSQL/Redis 集成验证。

首次运行浏览器测试需 pnpm exec playwright install chromium。
CI 使用 pnpm exec playwright install --with-deps chromium。
浏览器测试失败留 trace/report；测试使用本地应用，不能连接线上接口。

## 本地 DB/队列集成

```sh
pnpm infra:up
pnpm db:migrate
ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

仅接受 loopback 的数据库/Redis URL，且必须显式允许。
数据库测试插入唯一用户/项目/任务，验证归属和幂等约束，finally 清理并验证。
队列使用每次运行独立名字，测试真实 Worker 的消息处理，finally 清理测试队列。
不调用模型、不扣积分、不上传对象。迁移可以在空白 CI 库上验证；
本地已有数据不能用清库方式测试。

## 需要继续补齐的产品测试

鉴权/跨用户隔离、重复提交、回调重放、断线恢复、单图失败重试、
计费并发、图片上传校验、草稿恢复、下载权限和画布版本冲突。
初始化测试通过不等于这些尚未实现的功能已验收。

## 手动验收

按 DESIGN.md 检查 390/768/1280/1440px、键盘操作、焦点返回、错误与空状态。
真实生图需使用明确授权的测试账户和限额，记录 provider 返回和结果存储证据。
不要把模拟完成动画或静态图称为端到端生成测试。

## 生图 API 集成

`pnpm test:integration` 现在同时运行诊断检查与 `@lycoboai/worker test:images`。
新增检查使用真实 PostgreSQL/Redis、独立 UUID 队列、临时私有图片目录和 loopback HTTP fixture；不调用付费模型。
配置、模型能力证据、身份签发和迁移边界见 [生图 API](image-generation-api.md)。
