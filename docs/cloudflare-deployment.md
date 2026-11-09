# Cloudflare Workers 运行与部署

更新：2026-11-06。生产统一使用 Cloudflare Workers、Queues、Durable Objects、Images 和私有 R2。现有新加坡 PostgreSQL 经 Hyperdrive 访问。图片生成、DeepSeek 提示词优化与规划已按用户授权开启，视频关闭。

## 运行单元

| Worker          | 入口与职责                                                                         | 公开入口                         |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `lycobo`        | `apps/api/src/cloudflare.ts`；Static Assets、Hono API、签名媒体和 `RealtimeHub` DO | `lycobo.com`、`media.lycobo.com` |
| `lycobo-images` | `apps/worker/src/cloudflare.ts`；图片 Queue、上传处理、变体与每分钟恢复 Cron       | 无公开 HTTP 入口                 |

两个 Worker 分别配置于 `wrangler.jsonc` 和 `wrangler.images.jsonc`，可以独立部署与回滚。图片消费者通过 `REALTIME` 跨 Worker 绑定访问主站命名空间，不能把图片处理放回主站请求内。

Hyperdrive 目标为新加坡 `aws-0-ap-southeast-1.pooler.supabase.com:5432`，项目 `uyfgzmqijdsesnlsiwqu`。两个 Worker 使用 `aws:ap-southeast-1` placement，业务查询关闭 Hyperdrive 缓存。每次调用创建并关闭自己的数据库客户端；提示词优化 SSE 在流结束、错误或取消后关闭连接，不因 HTTP 响应已返回而提前关闭。

Node API、Sharp、S3 与 LISTEN/SSE 仅用于隔离本地开发及测试。生产任务状态使用 [可休眠 WebSocket](realtime.md)，正常在线不定时查询任务 API。

## 图片处理

上传文件先暂存私有 R2，并保存恢复意图，再发送 Queue。图片 Worker 校验输入，使用 Images binding 解码、清理元信息、规范化 PNG，并生成 WebP 预览与缩略图，最后登记 PostgreSQL 素材。重复消息使用稳定素材 ID 和内容哈希，回执丢失不会生成另一份素材。

原始桶保持私有，禁止 r2.dev 或其他入口直接公开。`/images/*` 经主站 Worker 校验短期签名、用途、来源与过期时间后读取 R2，缺失派生变体通过 Queue 补齐。付费输出不套用浏览器参考图压缩规则。源图保存与规范化并行，验证 PNG 后，原图写入与缩略图、预览图处理最多三路并行；所有分支结束后才返回，失败保留源图，不提前确认任务成功。无透明通道的供应商参考图可以压缩为 JPEG，透明图保留 PNG。

上传的有限时长回执确认仍属于上传操作自身；已创建的生图任务不启用浏览器定时轮询。视频提交、视频队列与 MP4 媒体入口在当前 Workers 中保持关闭。

## 任务、回调与付费开关

任务、扣费和 outbox 在同一个 PostgreSQL 事务中提交。API 只投递已持久化的意图，独立消费者受租约、执行令牌和幂等约束保护；有歧义的供应商提交不能自动重投。

`CLOUDFLARE_TASKS_SINCE=2026-11-06T02:05:11.556Z` 是固定接管时间，部署不能重置。任务认领、超时处理和恢复都保持该边界，防止旧执行被重新计费。当前两个 Worker 的 `CLOUDFLARE_GENERATION_ENABLED`、`CLOUDFLARE_CONSUMER_ENABLED` 与 `IMAGE_WEBHOOK_ENABLED` 均为 `true`。

生图 Key 使用独立的 `lycobo-cloudflare`。Webhook 接收地址为 `https://lycobo.com/api/v1/webhooks/fluxport/images`，按原始请求体做 HMAC 签名与时间窗口校验。没有回调的中转站通过延迟消息查询原任务，不依赖浏览器保持在线，详见 [图片回调](image-webhooks.md)。

提示词优化与规划同样受生成开关约束。检查、构建、部署、健康探测和签名拒绝测试均不需要调用真实付费模型；真实生成由用户按明确额度测试。

## 绑定与 Secrets

| 项目               | 当前资源                                                 |
| ------------------ | -------------------------------------------------------- |
| Cloudflare Account | `9a65fad90669d9c27b58d856ab3ce410`                       |
| Hyperdrive         | `7ce66ede4e634fab8dc16240a6cedb6c`                       |
| R2                 | `lycobo-media-prod`，私有                                |
| 图片 Queue         | `lycobo-images`，独立消费者 `lycobo-images`              |
| 死信 Queue         | `lycobo-images-dead`                                     |
| SQLite DO          | `lycobo_RealtimeHub`，`631c155e20c2425ab2926cba7c790813` |
| 主站资产           | `apps/web/dist`；业务密钥不能进入 `VITE_*`               |

主站需要 `AUTH_JWT_SECRET`、`ASSET_SIGNING_SECRET`、`STANDALONE_IMAGE_API_KEY`、`DEEPSEEK_API_KEY`、`IMAGE_WEBHOOK_SECRET`。图片 Worker 只需要媒体签名与两个模型密钥。普通变量、域名、Queue 和绑定以两个 Wrangler 配置为准。

Secrets 使用受保护输入或忽略的临时文件配置；不能写入 Git、命令参数、日志或前端。`backups/`、`.env*`、`.dev.vars*`、`.cloudflare/` 保持 Git 忽略，只有 `.env.example` 可提交。不得依赖开发进程自动继承生产基础设施凭据。

## 发布顺序

1. 按 AGENTS.md 核对目标账号、Worker、Git 版本、迁移和用户授权；`pnpm check` 与隔离验证通过后再发布。
2. 有表结构变化时，先执行经审查的 PostgreSQL 追加迁移；应用不会自动 db push。
3. `pnpm cf:types` 生成绑定类型，`pnpm build` 构建前端并分别 dry run 两个 Worker。
4. 初次创建 DO 或修改跨 Worker 绑定时，先部署主站，再部署图片 Worker；仅修改前端时可只部署主站。凭据必须显式加载并校验目标。
5. 使用 `pnpm cf:check:config` 同时比较控制台设置和 100% 活动版本。控制台保存的草稿不等于当前正在处理请求的版本。
6. 验证首页、API、私有媒体拒绝与 WebSocket，再根据实际产品变化发布 `release.json` 公告。日志或配置修复不重复公告。

构建或 dry run 通过只说明制品可生成，不代表线上资源和模型可用。具体回放、消息、版本公告及隔离运行时测试见 [实时推送](realtime.md)。

## 已核对的线上记录

2026-11-06：请求去重实现 `de678015` 已推送 dev 并部署，主站版本 `b73b9580-7e11-49f1-b2c3-5a986f5a52aa`；图片 Worker 版本 `6d739b49-dd2c-4993-b0ee-327902910ef9`。两者均为 100% 活动版本，控制台变量与 Secret 类型检查无差异。两个 `REALTIME` 绑定指向同一个 SQLite 命名空间。

数据库已应用 `0043_realtime_push`，共 44 项迁移，51 张业务表维持 RLS 与前端角色限制。发布摘要 `2026.11.06-realtime.1` 已实际经 PostgreSQL outbox → 图片 Worker Cron → DO → 浏览器到达，WebSocket 握手、ready 和自动 pong 均已验证。

后续本地清理提交不自动改变上面的部署记录；远端实际版本以 Cloudflare Deployments 和配置检查结果为准。


## 提交路径的等待边界

浏览器新参考图最多三张同时上传，返回的素材编号仍按用户选择顺序排列；已有 assetId 或上传查询缓存直接复用。所有新上传参考图都尝试 WebP 压缩：最长边 3840px、不放大、保留透明度，目标约 1MB，必要时逐步降采样；尺寸合适且原文件更小时保留原文件。上传和服务端验证完成前不创建付费任务。

套图计划的文本请求与上传同时开始，以 referenceCount 告知规划模型参考图数量，不携带图像；即使上传失败，已经生成的计划仍保留。点击生图时等待同一上传缓存或重试失败上传，再由服务端确认素材数量、归属和有效期；已有计划仍按原素材 ID 与顺序校验。接口为可选字段扩展、无数据库迁移，部署先更新 API/共享服务端，再更新前端。

主站业务响应在持久化完成后，通过 ctx.waitUntil 投递实时 outbox 并关闭调用级数据库连接，避免消息传输延迟阻塞普通响应。SSE 仍保留连接至流结束；图片 outbox 唤醒继续由提交路径等待，模型生成仍在独立消费者中执行。后台消息投递失败保留持久 outbox，由恢复链路处理。waitUntil 有平台生命周期限制，不是持久任务执行器。

这些优化减少可避免的串行等待，不代表规划模型或跨境链路延迟已消除。验收需分别测量上传、POST 首字节、SSE 首段和完成时间；不要用 fixture 耗时宣称线上提速比例。


## 2026-11-09 提交性能部署验证

性能提交 `7fe0a440` 已推送 dev 并部署。主站活动版本 `e8ad7ad5-a894-45e8-9e46-29e5a7ffb51a`，图片 Worker 活动版本 `9cf56173-e0e3-46ab-9caf-9b336b8b6299`；配置检查确认两者为 100% 活动版本，控制台与版本绑定无差异。没有新增迁移。

登录浏览器的一份无参考图、单条纯文本计划实测：响应头 428ms、首段文本 1179ms、完整计划 1860ms。使用该计划提交一张图片，202 响应完整接收耗时 1582ms；任务 `WBK3EMH1H` 于北京时间 14:30:38.515 创建、14:31:16.118 完成，数据库记录耗时 37603ms。结果 WebP 缩略图读取为 200，耗时 279ms。健康检查 200，未签名媒体访问 403。

以上为部署后各一次样本，没有部署前同条件对照，也未覆盖新参考图上传或国内不同 VPN 出口；不能据此计算提速比例或作为 P95。规划请求仅发送文本与参考图编号，现有 variation-planner.test.ts 对 image_url、data:image 和 base64 有拒绝出现断言；规划前依然等待自有存储完成上传，计时要与模型处理分开。


## 2026-11-09 并行规划与统一压缩部署

代码 `5747eadf` 已推送 dev 并部署。主站版本 `50052de7-aa0c-4b67-b3d9-36c99c7abb2a`，图片 Worker 版本 `6e098551-2acf-41a1-b0f6-bf88bfc2fae4`；配置检查确认两者为 100% 活动版本且控制台与版本绑定无差异，无新增迁移。

线上套图计划与公共生图客户端的 JavaScript 文件均返回 200，SHA-256 与本地本次构建完全一致。首页、套图计划路由、健康接口返回 200，未签名私有媒体返回 403。本次部署验收未新增付费模型调用；并行上传等待、失败保留计划与最终素材校验依据提交前的单测和隔离数据库集成，透明压缩依据真实浏览器测试，不能把静态资源验收当作新的线上模型端到端计时。
