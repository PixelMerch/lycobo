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

企业账号与 JWT 的隔离数据库测试已接入根集成命令，具体覆盖与运行边界见 [企业鉴权](enterprise-auth.md)。

## 实时事件与图片集成隔离

图片 API／Worker 集成测试现在创建独立临时数据库并执行完整迁移，配合独立 Redis 队列与临时图片目录；避免本地运行中的真实 Worker 抢到 fixture outbox。最终关闭连接后删除测试数据库，不接触共享数据或卷。

根 test:integration 已增加 `@lycoboai/api test:events`，覆盖 SSE 的持久化事件、跨连接通知、回滚、租户隔离、重连回放与身份撤销。运行需 loopback PostgreSQL、Redis 和 ALLOW_LOCAL_INTEGRATION=true；不会调用付费模型。


## 工作台浏览器回归

`tests/e2e/image-preview.spec.ts` 验证全屏预览、缩放拖动、移动布局和图片切换后的说明同步；`library-dialog.spec.ts` 验证筛选、延迟加载和弹层焦点恢复。接口均由浏览器 fixture 拦截，不调用模型。

并行执行不同测试任务时，为每次运行设置独立 `--output=/tmp/<本次运行目录>`，避免 Playwright 清理其他运行的 trace。历史时间断言使用浏览器自身时区计算，不能写死本机的 UTC+8 时间。正式验收仍需运行完整 `pnpm test:e2e`，不能以跳过失败用例代替。

企业共享钱包测试纳入 worker test:images：verify-wallet.ts 验证主子账号并发扣款、20币固定价格、逐图退款、充值重复入账、账本不可修改和分页。wallet.spec.ts 验证账户中心真实接口契约（浏览器 fixture）。

弹层焦点回归同时覆盖鼠标点击和不预先聚焦的虚拟点击。受控预览在挂载时记录返回目标，因此打开前需聚焦入口按钮；关闭动画结束后仍由 HeroUI 恢复焦点。不能通过预先在测试中 focus 或删除焦点断言掩盖问题。
