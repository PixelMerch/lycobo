# Cloudflare Workers 运行与部署

更新：2026-11-06。`dev` 的生产运行目标统一为 Cloudflare Workers，不再提供 CloudBase 运行或发布入口。本次后端已部署到 `lycobo.com`，图片 Queue、Hyperdrive、Secrets 和媒体域名已绑定；当前已按用户授权开放图片生成、DeepSeek 提示词优化和智能规划，视频保持关闭；Webhook 接收与无回调延迟查询并行支持。Supabase 新加坡 PostgreSQL 与已复制的私有 R2 数据继续使用；不是将 PostgreSQL 改为 D1。

## 运行边界

生产使用两个独立 Worker，分别发布和回滚：

| Worker          | 配置与入口                                               | 职责                                                                                                              |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lycobo`        | `wrangler.jsonc`、`apps/api/src/cloudflare.ts`           | Static Assets 前端、Hono `/api/*`、签名 `/images/*`；只投递图片消息                                               |
| `lycobo-images` | `wrangler.images.jsonc`、`apps/worker/src/cloudflare.ts` | `queue` 图片上传及变体处理、`scheduled` 每分钟恢复持久上传意图；不提供 HTTP handler、域名、workers.dev 或预览 URL |

图片解码和编码由消费者调用 Images binding，不在 HTTP 请求里运行 Sharp。付费开关关闭时，Queue 不调用模型，Cron 不派发或结算付费执行项；当前两边付费开关已按用户授权开启。没有常驻 Node 循环、LISTEN 或 HTTP 请求后的付费后台 Promise。API 与消费者共用现有 Queue、私有 R2、禁用查询缓存的 Hyperdrive 和固定接管时间；拆分不迁移业务数据，也不增加数据库容量。

API 与消费者用 Hyperdrive 连接现有 PostgreSQL。每次调用创建并关闭自己的 Postgres.js 客户端，沿用 `prepare: true`；Hyperdrive 配置必须关闭查询缓存，钱包、会话、任务状态要求及时读取。两个 Worker 的 placement 均配置为 `aws:ap-southeast-1`。任务、钱包、消息和版本更新统一使用 Durable Objects + 可休眠 WebSocket，正常情况下不再定时轮询任务 API；提示词优化保留 SSE。协议与发布步骤见 [实时推送](realtime.md)。

Node API、S3/Sharp 和本地消费者仅用于隔离开发及既有测试，不是生产备用入口。CloudBase 数据库适配、HTTP/Event 入口、唤醒代码和部署工作流已移除。`cloudbase/migrations/`、旧部署记录和一次性源文件复制适配保留为历史证据，不在 Worker 中加载。

## 上传参考图

浏览器继续执行既有的大文件上传压缩。POST `/api/v1/image-assets` 完成鉴权、Content-Type 和请求大小限制后，将待处理字节及服务器解析的身份写入私有 R2 `_uploads/`，返回 `202 {uploadId}`，不返回素材成功记录。

Queue 只接收 `{version: 1, uploadId}`。消费者读取持久上传意图，执行实际解码校验、拒绝动画、最长边 3840px/4MiB 限制、PNG 标准化和 WebP 展示变体，随后在 PostgreSQL 登记素材。客户端通过已鉴权的 `/api/v1/image-uploads/:id` 等待处理结果；只有取得真实素材 ID 后才允许提交生成。状态查询同时校验组织和上传人，不向客户端返回 R2 key。

上传意图先于消息持久化，Queue 发送失败由 Cron 补投。重复消息使用同一素材 ID；素材登记校验归属、对象 key 和 SHA-256，已登记但回执丢失时直接恢复回执。待处理上传与回执有效期一天，成功/无效图片处理后删除暂存输入。Cron 分页扫描并保存游标；存储临时失败保留输入等待重试。前端轮询窗口为两分钟，单次请求受超时限制；超时明确报告仍在处理，不编造上传成功。

## 付费任务与恢复

任务、扣费和 outbox 保持在同一 PostgreSQL 事务。Queue 消息只携带 item ID；数据库领取、执行 token 和旧尝试隔离仍决定是否允许调用供应商。重复消息不得再次调用结果未决的付费提交。异步供应商查询通过延迟消息继续，Cron 补投修复发送/确认间隙。

Queue 初始配置：batch size 1、最多 2 个并发 consumer、3 次传输重试、30 秒重试延迟，并指定独立死信队列。Queue 的重试不是重新生成；业务明确失败和结果未决继续走现有退款/对账逻辑。死信需人工检查，禁止将其中消息直接解释为可重新收费的任务。

接收供应商图片后，先保存私有 `.png.source` 检查点，再进行 Images 转换。变体失败保留已写原图及检查点，不能因此重投模型。当前没有新增“从检查点自动恢复全部图片处理阶段”的业务状态机：付费结果的存储故障按现有逻辑进入待确认，不能宣传成全自动恢复。此类检查点的自动清理后续单独制定；当前 Cron 不删除快照中的原始素材。

`CLOUDFLARE_TASKS_SINCE` 是本次接管新任务的固定时间。outbox、claim、超时扫描和无效响应自动退款均按执行项创建时间限制在此时间之后；旧任务经用户明确确认而新建的重试执行项仍可处理，防止接管复制的国内旧执行意图。当前固定接管时间为 `2026-11-06T02:05:11.556Z`，后续部署不能重置。消费者与付费生成开关当前均为 `true`，API、Queue 和 Cron 可以处理用户提交的新任务。`IMAGE_WEBHOOK_ENABLED=true` 对新任务启用回调等待，但无回调仍会由延迟消息及 Cron 查询原任务。

## 图片与视频边界

- 原图保持 PNG，展示图沿用 512px/质量 76、1600px/质量 82 的 WebP；PNG 不设置有损调色板质量参数，保留透明度。
- 参考图完成标准化后不再次编码同一 PNG。当前供应商参考图保留有界 PNG，不做旧的 JPEG 传输优化，避免改变透明度与局部编辑源图像素；传输体积与费用需要实测。
- Images binding 的输入上限为 20MB，而旧供应商输出契约允许 32MiB。当前超出 binding 范围会明确失败并保留已接收的源结果，不自动降低付费原图分辨率或再次调用供应商。需用真实供应商输出确认覆盖范围。
- 缺失展示变体的已授权请求只向 Queue 投递编号，返回可重试的 503；不在媒体 HTTP 请求里转换，也不返回占位成功。已有迁移变体直接读取。
- 视频生成、视频消费者、视频封面及播放不接入本次 Worker；媒体入口拒绝 MP4，API 视频能力保持关闭。旧视频代码、历史数据和 fixtures 不代表当前可用功能。

## 绑定与变量

| 项目             | 配置与用途                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA`          | 私有 R2 `lycobo-media-prod`，保持直接公开入口关闭                                                                          |
| `IMAGES`         | Images binding，需确认账号套餐与转换额度                                                                                   |
| `HYPERDRIVE`     | `lycobo-supabase-overseas`，ID `7ce66ede4e634fab8dc16240a6cedb6c`；新加坡 PostgreSQL，查询缓存关闭                         |
| `IMAGE_QUEUE`    | `lycobo-images`，由独立 `lycobo-images` Worker 消费，主站只投递                                                            |
| 死信 Queue       | `lycobo-images-dead`，不自动消费和重新收费                                                                                 |
| `ASSETS`         | `apps/web/dist`，后端密钥不进入 Vite 构建变量                                                                              |
| Origin、媒体前缀 | 核对 `AUTH_TRUSTED_ORIGINS`、`ASSET_ALLOWED_ORIGINS`、`ASSET_PUBLIC_ORIGIN` 和 `/images/`                                  |
| 运行开关         | `CLOUDFLARE_GENERATION_ENABLED=true`、`CLOUDFLARE_CONSUMER_ENABLED=true`                                                   |
| 接管时间         | `CLOUDFLARE_TASKS_SINCE`，固定 ISO UTC 时间，启用时必须不晚于当前时间                                                      |
| Secrets          | `AUTH_JWT_SECRET`、`ASSET_SIGNING_SECRET`、`STANDALONE_IMAGE_API_KEY`、`DEEPSEEK_API_KEY`、API 专用 `IMAGE_WEBHOOK_SECRET` |

海外使用独立签名密钥，旧环境会话不能视为海外登录凭据。Secrets 通过受保护的输入或文件配置，不写入 Git、命令参数、日志和前端；不依赖从旧 `.env` 自动继承 CloudBase 参数。

## 本次部署与验收

2026-11-06 首次单 Worker 发布版本为 `930bfff8-f833-451a-8ee0-becf11190087`，该编号仅作迁移历史记录。当前发布单元已拆为 `lycobo` 与 `lycobo-images`，实际活动版本以 Cloudflare Deployments 为准。根域与 `media.lycobo.com` 均为 `lycobo` Worker Custom Domain；已移除原先禁用的 R2 媒体域名映射，R2 的直接公开入口保持关闭。主站配置五项 Secrets；消费者仅配置媒体签名和两个模型密钥，不持有账号 JWT 或 Webhook 签名密钥。Cloudflare 使用独立生图 Key，不改变原 CloudBase Key 的回调。配置和日志不保存密钥值；观测配置开启查询参数脱敏，避免签名 URL 进入请求日志。

当前账号在上传时被 Cloudflare 判定为 Free 计划，自定义 CPU 上限被 API 拒绝，因此已移除 `limits.cpu_ms`，使用平台默认限制，未变更付费套餐。不能用本次轻量检查推断大图并发、真实账号密码校验和付费生成的性能上限。

已验证：浏览器首页与登录弹层正常；健康 API 返回 JSON；未登录 API 返回 401；模型展示数据通过 Hyperdrive 读库返回 200；随机不存在账号的登录探测返回 `INVALID_CREDENTIALS`；已复制素材的签名 WebP 缩略图和 PNG 下载均返回 200，未签名媒体返回 403。向图片 Queue 投递不存在上传 ID 的无副作用探测消息，随后积压为 0；这仅验证消息接收与空意图处理，不代表真实图片转换验收。未创建线上测试用户、素材或付费任务。

本机开发 token 不能认证海外账号，未绕过账号权限；真实用户登录、线上参考图上传到 Queue 后的转换质量和延迟仍待用有效账号验收。本地实际应用 workerd 的完整上传链路已有隔离验证记录。本次配置工作未调用真实付费模型，视频不开放。

拆分后远端复查：`lycobo` 版本 `4d702b56-4f6f-4045-9c3a-053fe8b45b6e`，`lycobo-images` 版本 `084e4d14-c8ef-44bf-860b-7c76127706de`，均为 100% 活动部署。Queue 唯一消费者为 `lycobo-images`，主站 schedules 为空，图片 Worker 每分钟执行恢复 Cron，两个 Worker 的生成开关均为 `false`。新消费者绑定后投递不存在上传意图的探测消息，队列与死信积压均为 0；该检查不代表有效图片转换质量验收。

## 本地验证与再次发布

```sh
pnpm cf:types          # 从固定版本 Wrangler 生成绑定类型
pnpm check            # 包含前端/本地 Node 构建和两个 Workers dry-run，不发布
pnpm test:cloudflare   # 隔离的 workerd + 本地 Images/R2 + scrypt fixture
```

`pnpm dev:cloudflare` 是主站 Wrangler 本地开发入口，`pnpm dev:cloudflare:images` 是图片消费者入口，真实 API 还需要显式的本地 Hyperdrive 连接与 `.dev.vars`。不得把生产数据库连接用于测试写入。`pnpm dev` 保留独立的 loopback PostgreSQL/S3 开发环境。

首次拆分部署先发布不接消息、无 Cron 的消费者候选，核对可用后，清除主站旧 Cron 并解绑旧 Queue consumer，再使用正式图片配置将同一队列和 Cron 挂到 `lycobo-images`；最后发布主站移除 Queue/Cron handler。不能仅依据消费者更新接口回显判断切换成功，必须 GET 复查实际 script 归属；旧绑定仍存在时，Cloudflare 会拒绝上传没有 Queue handler 的主站版本。队列消息和上传意图不清空；切换后确认只有一个消费者且只有图片 Worker 挂载 Cron。之后两个配置可独立发布，不能重新向主站加回消费者。

再次发布需用户授权，并核对目标账号、真实资源绑定、固定接管时间和运行开关。使用项目固定版本 Wrangler，通过受保护的 Secrets 文件部署；不要将密钥写入命令参数。现存旧 Hyperdrive `lycobo-supabase` 指向不同项目，未复用或修改。真实付费模型调用另需明确授权。部署成功不能证明图片质量、端到端延迟或线上生成可用。

本地验证记录见 [测试与验收](testing.md)。旧环境数据复制证据见 [海外迁移记录](overseas-deployment.md)。

## 官方依据

- [Images binding](https://developers.cloudflare.com/images/optimization/binding/)、[图片限制](https://developers.cloudflare.com/images/get-started/limits/)
- [Queue 消费者管理](https://developers.cloudflare.com/queues/configuration/configure-queues/)
- [Queues 重试和延迟](https://developers.cloudflare.com/queues/configuration/batching-retries/)、[Queues 限制](https://developers.cloudflare.com/queues/platform/limits/)
- [Hyperdrive/Postgres.js](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/)、[查询缓存](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)

本次开放付费模型并挂载 Webhook 接收端：支持原始字节签名、时间窗及事件头校验；独立图片消费者在等待回调时也投递延迟查询，收到提前回调则尽快查原任务。供应商回调配置和缺失回调恢复策略见 [图片 Webhook 与延迟查询](image-webhooks.md)。之前关闭开关的发布版本仅为试用历史记录，当前配置以本节开头和仓库配置为准。

本次开放部署复查（2026-11-06）：主站 `cd9af2a2-f08f-4e51-b360-9c66bc69672c`，图片消费者 `60edcbc7-9e6d-4437-ba68-cae2229c5ee8`，均为 100% 活动版本。两边生成和回调开关为 `true`；独立 Key 的四个已配置图片型号通过只读模型目录核对。公网无签名、错误签名、过期签名、篡改请求均返回 401，合法签名但无效 JSON 返回 400；未写入伪造任务或回调事件，未调用真实付费模型。主站健康检查正常，唯一消费者仍为 `lycobo-images`，队列积压为 0。真实供应商回调、生图、结果转换和账务完整闭环留给用户在线验收。

## 控制台草稿与活动版本一致性

2026-11-06 北京时间 10:47:05 发布主站后，10:47:20 控制台又保存了一份未发布版本 `65a183cb-24c2-4c1f-a3c9-aae765410646`，标注为 `Updated variable: CLOUDFLARE_GENERATION_ENABLED`。该版本基于旧配置，回调开关仍为 `false` 且缺少 `IMAGE_WEBHOOK_SECRET`；主站活动版本仍为已启用回调的 `cd9af2a2-f08f-4e51-b360-9c66bc69672c`。因此设置页显示旧值，并非当时运行中的版本关闭了回调。

配置以仓库为准；发布时显式上传正确 Secrets，完成后执行 `pnpm cf:check:config`。该只读命令比对两个 Worker 的仓库变量、必需 Secret 名称、脚本设置记录和 100% 活动版本，差异仅输出字段名，不读取或打印加密密钥值。需要已有 Cloudflare 管理凭据，本地自动读取被忽略的 `.env.cloudflare`；使用网络代理时可加 `NODE_USE_ENV_PROXY=1`。控制台保存后的新版本不等于当前承接流量的版本，不应从旧设置页面直接覆盖新部署。

提示词优化的 Workers 兼容修复：供应商请求使用 `redirect: manual` 并检查响应状态，拒绝 3xx，不跟随重定向发送密钥。Workers 不支持 `redirect: error`，旧配置会在真正发送请求前抛出 TypeError，业务失败后退还预扣积分。SSE 响应的数据库连接保持到流完成、失败或取消后再释放，不在返回响应头时提前关闭。新增实际 workerd 的 fixture 优化链路，避免 Node fetch mock 忽略运行时选项差异。验证未调用真实模型，用户复测结果单独确认。

## 2026-11-06 实时推送发布

本次实现提交 `019ee22d`，更新提示文案修正 `51e02fd5`，已推送 `origin/dev`。生产数据库完成 `0043_realtime_push`，迁移链共 44 项，51 张业务表保持 RLS 和前端角色权限限制。未导入测试数据、未调用真实付费模型，视频保持关闭。

- 主站 `lycobo`：`a8a6f54b-58f7-4e39-9a0e-ac03e4e4f472`，100% 活动版本。
- 图片消费者 `lycobo-images`：`6d739b49-dd2c-4993-b0ee-327902910ef9`，100% 活动版本。
- SQLite DO 命名空间 `lycobo_RealtimeHub`：`631c155e20c2425ab2926cba7c790813`。两个 Worker 的 `REALTIME` 绑定指向同一命名空间，消费者使用 `script_name=lycobo`。
- 控制台设置与活动版本的变量／Secret 类型检查均无差异，既有生成、消费者与 Webhook 开关保持 `true`，固定接管时间未改变。
- 发布摘要版本 `2026.11.06-realtime.1` 已在两个 Worker 部署成功后幂等写入，系统消息与更新事件由持久 outbox 投递。

验证：`pnpm check`（399 通过、1 跳过）、隔离 `pnpm test:integration`、真实本地 `pnpm test:cloudflare`，以及 account-menu／generation-live／realtime 三份定向浏览器文件（20 通过）。未运行完整本地 E2E。线上首页、工作台入口、健康接口和私有媒体拒绝规则正常，真实浏览器已验证公开 WebSocket 的握手、ready 与自动 pong，并实际收到 `2026.11.06-realtime.1` 公告，确认 PostgreSQL outbox → 图片 Worker Cron → DO RPC → 浏览器推送整条链路。协议及已知浏览器冻结行为见 [实时推送](realtime.md)。
