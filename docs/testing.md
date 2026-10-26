# 测试与验收

## 自动检查

- pnpm lint：Biome + 浏览器/server-only 边界检查。
- pnpm typecheck：所有 workspace 包 strict TypeScript。
- pnpm test：契约、API、Worker 的单元行为。
- pnpm build：实际前端和两个 Node 应用生产构建。
- pnpm test:e2e：真实 Chromium 下接口连接、路由、禁用态与窄屏溢出。
- pnpm test:integration：明确 opt-in 的本地 PostgreSQL 和 Cloudflare workerd 集成验证。

首次运行浏览器测试需 pnpm exec playwright install chromium。
CI 使用 pnpm exec playwright install --with-deps chromium。
浏览器测试失败留 trace/report；测试使用本地应用，不能连接线上接口。

## 本地开发与远程回归

日常 AI 开发默认执行 `pnpm check` 和 `git diff --check`，不在每次样式、文案或布局调整后运行本地全量 E2E。关键交互变化、已知回归或用户明确要求时，只运行相关浏览器用例；例如 `pnpm test:e2e tests/e2e/preview-workspace.spec.ts`。不为纯视觉数值补写镜像测试。

一批改动完成并获授权推送后，由远程 CI 运行全量浏览器回归；等待检查通过再合并。未推送时说明远程验证尚未执行，不因测试流程调整自动推送或发布。

## CI 分层浏览器检查

| 触发场景 | Browser 检查 |
| --- | --- |
| 推送 dev | `pnpm test:e2e`，批次完成后的全量回归 |
| 目标为 dev 的 PR | `pnpm test:e2e:smoke`，只跑核心流程 |
| 目标为 main 的 PR | `pnpm test:e2e`，合并前全量回归 |
| 推送 main（含合并） | `pnpm test:e2e`，全量回归 |
| 手动运行 CI | `pnpm test:e2e`，全量回归 |

冒烟范围：首页到创作路由、登录/退出后的历史同步、会话续期、真实接口契约 fixture 下的提交/参考图上传、草稿保留与桌面/移动导航。它不替代发布前的完整回归。本地按改动风险选择相关用例，不默认重跑全套。

Quality 和 Infrastructure 保持原检查范围；分支保护所需的 `Browser` 名称保持不变，由同一 job 明确选择全量或冒烟。不能通过顶层路径过滤跳过必需检查，否则可能一直处于 Pending。

PR 标题校验拆为独立 `pr-title.yml`，仍报告 `PR title`。编辑标题或描述仅重跑该轻量工作流，不取消或重启完整 CI；新提交仍会触发完整的对应级别检查。改动 PR 目标分支则重新执行 CI，以免从 dev 改投 main 后沿用冒烟结果。纯元数据编辑的 CI 使用独立并发组和非必需检查名称并跳过任务，不覆盖之前的必需检查结果。此调整不改变 main 的分支保护。

## 本地 DB/队列集成

```sh
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

仅接受 loopback 的数据库 URL，且必须显式允许。
运行时 `DATABASE_URL` 已指向 Supabase 时，测试命令须显式覆盖为本项目本地 PostgreSQL 地址，例如 `DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration`；不修改远端库，也不将运行时配置改回本地。
数据库测试在 loopback 服务插入唯一用户/项目/任务，验证归属和幂等约束，finally 清理并验证。
队列使用每次运行独立名字，通过真实本地 workerd 验证 Queue 投递与消费者，finally 释放整个临时模拟环境。
不调用模型、不扣积分、不上传对象。迁移可以在空白 CI 库上验证；
本地已有数据不能用清库方式测试。

## 本地 Redis 集成

```sh
pnpm infra:up
ALLOW_LOCAL_INTEGRATION=true pnpm test:redis
```

仅接受 loopback Redis，每次创建独立 UUID 前缀并在 finally 删除自己的 Stream，不执行 FLUSHDB 或清理共享卷。覆盖只传任务 ID、消费者退出后未确认消息恢复、执行中心跳防抢占、单条消息有限重试及死信、HTTP 桥接认证和成功确认。使用 loopback HTTP fixture，不调用付费模型；数据库 claim／计费不变量由原 PostgreSQL 隔离集成检查覆盖。Infrastructure CI 同时运行生产 Cloudflare Queues 模拟验证和本地 Redis 验证。

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
新增检查使用真实 PostgreSQL 与 workerd、独立 UUID 队列、临时私有图片目录和 loopback HTTP fixture；不调用付费模型。
配置、模型能力证据、身份签发和迁移边界见 [生图 API](image-generation-api.md)。

企业账号与 JWT 的隔离数据库测试已接入根集成命令，具体覆盖与运行边界见 [企业鉴权](enterprise-auth.md)。

## 实时事件与图片集成隔离

图片 API／Worker 集成测试现在创建独立临时数据库并执行完整迁移，配合独立本地 Cloudflare 队列与临时图片目录；避免本地运行中的真实 Worker 抢到 fixture outbox。最终关闭连接后删除测试数据库，不接触共享数据或卷。

根 test:integration 已增加 `@lycoboai/api test:events`，覆盖 SSE 的持久化事件、跨连接通知、回滚、租户隔离、重连回放与身份撤销。运行需 loopback PostgreSQL、本地 workerd 和 ALLOW_LOCAL_INTEGRATION=true；不会调用付费模型。

## 工作台浏览器回归

`tests/e2e/image-preview.spec.ts` 验证全屏预览、缩放拖动、移动布局和图片切换后的说明同步；`library-dialog.spec.ts` 验证筛选、延迟加载和弹层焦点恢复。接口均由浏览器 fixture 拦截，不调用模型。

并行执行不同测试任务时，为每次运行设置独立 `--output=/tmp/<本次运行目录>`，避免 Playwright 清理其他运行的 trace。历史时间断言使用浏览器自身时区计算，不能写死本机的 UTC+8 时间。完整 `pnpm test:e2e` 默认在远程 CI 执行；本地复现可指定文件或用例，不能以跳过失败用例代替查明原因。

企业共享钱包测试纳入 worker test:images：verify-wallet.ts 验证主子账号并发扣款、20币固定价格、逐图退款、充值重复入账、账本不可修改和分页。wallet.spec.ts 验证账户中心真实接口契约（浏览器 fixture）。

弹层焦点回归同时覆盖鼠标点击和不预先聚焦的虚拟点击。受控预览在挂载时记录返回目标，因此打开前需聚焦入口按钮；预览入口位于 Modal 的触发器树外，由历史组件保留其引用，在关闭动画结束、弹层卸载后恢复焦点；弹层内部的焦点约束仍交给 HeroUI。不能通过预先在测试中 focus 或删除焦点断言掩盖问题。

原任务重试集成覆盖：同键并发只扣一次、跨组织拒绝、部分失败保留成功图片、旧执行被隔离、无效响应退币与历史待确认记录幂等修复。failure-retry.spec.ts 验证前端使用原任务 retry 接口，不追加失败历史。

通用生成命名升级由 `verify-generation-migration.ts` 纳入 worker `test:images`：
先在独立空库执行到 0013，创建七张旧表、素材和局部修改的关联数据，
再执行 0014 核对改名；建立旧视图依赖并确认 0015 删除受阻后，清理测试依赖再迁移。
验证八个旧名均消失，表 OID、记录、素材／修改关联、提交幂等和退款唯一性保持，
数据库函数不再引用旧表名。后续图片／钱包／SSE 检查全部在无兼容视图的结构上运行。
测试数据库和临时迁移目录结束后清理，不操作现有业务数据，也不调用付费模型。

## 家纺主图裂变

`packages/generation/src/textile-generation.test.ts` 验证10个独立服务端视角预设、版本、重复与未知视角、普通任务4张上限和一视角一张约束；图片API测试验证客户端模型／提示词／质量无法覆盖服务端固定配置。

`verify-textile-generation.ts` 纳入 worker `test:images`，在隔离临时库与私有临时图片目录中验证10张提交、原子扣200积分及10条outbox、同键重放、跨组织引用拒绝、工具历史筛选、每个position不同提示词及每次请求携带有序的1张主图和5张详情图、重复消费不调用服务商、9成功1失败净扣180积分、失败重试仅保留原position。服务商为本地注入fixture，未调用外部模型。根集成命令仍覆盖Queues/R2/Images与鉴权SSE。

`tests/e2e/textile-generation.spec.ts` 使用接口fixture验证选中10视角后提交10张与六张有序参考、历史视角标记、部分失败与实时更新、刷新和重新编辑、普通创作历史隔离，以及丢失响应后刷新仍复用同一幂等键。全量浏览器测试仍由远程CI运行。
