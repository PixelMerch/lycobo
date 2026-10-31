# Vakv 生图 API、队列与持久化

生图服务已接到当前工作台；服务端默认关闭，需显式配置后启用。本地真实调用验收见文末。
接口以组织为数据边界，用户身份来自服务端验证的访问令牌与数据库成员关系；请求体不得提供 userId、organizationId 或 workerId。
既有 `/api/v1/tasks` 契约和前端演示保持原状，新接口使用独立路径与新增数据库表。

## 当前最低输出档：1.5K

主站新草稿提供1.5K／2K／4K。1.5K正方形精确1254×1254；其他比例长边1254，短边四舍五入到整数。契约继续接受旧1K，已保存快照、旧任务重试及1024px结果不回写。公开选择项与兼容枚举分开，不能删除旧值导致历史无法解析。

尺寸映射共用 contracts.imageOutputDimensions；Images协议提交精确size，Gemini原生使用2K后由私有存储处理成目标像素。新1.5K结果入库存储前校验源图尺寸，不把低清图放大；缩略图从最终图派生，元数据与下载文件一致。渠道可设置独立1.5K上游模型，未配置时回落到旧1K映射、再回落通道默认值。发布顺序为API／Worker与后台契约在前、主站在后，旧消费者不识别新枚举。

2026-10-29本地真实调用：Image 2.5、文生图、单张、1.5K任务 `f7763c0b-eae3-4d16-a386-df49951ebbe6` 成功，保存宽高1254×1254；只创建一次任务，不自动重试。此证据不覆盖参考图编辑、Gemini付费调用或其他供应商。Cloudflare Images模拟与Node存储测试验证精确缩放和低清拒绝。

下方Vakv文档证据描述早期固定供应商，当前可配置中转站与协议见[模型服务](model-services.md)，不能把旧线路的规格套用于所有渠道。

## 模型能力证据

来源：[官方接口文档](https://docs.vakv.cn/wendang.html#gpt-image)、[价格页面](https://vakv.cn/pricing)、其公开数据接口 `https://vakv.cn/api/pricing`。

| 模型 | 官方文档确认的分辨率 | 默认可提交 |
| --- | --- | --- |
| gpt-image-2 | 仅 1K | 1K |
| gpt-image-2-4K | 1K、2K、4K；高分辨率为增强放大，不是原生 4K | 1K、2K、4K |
| gpt-image-2.5 | 本次 1K 实测成功 | 1K、2K、4K |
| gpt-image-2.5-flare | 本次 1K 实测成功 | 1K、2K、4K |
| gpt-image-2.5-sunburst | 本次 1K 实测成功 | 1K、2K、4K |

五个模型共用 `POST /v1/images/generations` 适配器。按用户于 2026-10-20 确认的产品规则，gpt-image-2 仅开放 1K，其余模型默认开放 1K、2K、4K。API 的 image-models、提交校验与 Worker 共用 catalog.allowedResolutions；documentedResolutions 继续只记录已有文档证据，不把产品开放范围冒充付费实测结果。旧 VAKV_CAPABILITY_OVERRIDES 仍可解析以兼容现有环境文件，但不再缩小 2.5 系列的档位，也不能扩展 image-2 的 1K 限制。

分辨率转尺寸目前采用长边 1024 / 2048 / 4096、短边按比例对齐到 16 像素；文档仅展示了 `1024x1024` 示例，没有穷举各比例尺寸。此尺寸映射及所有高分辨率仍需真实渠道验收。保存返回图片的实际宽高，不将请求档位当作实际像素证据。

参考图编辑适配 `POST /v1/images/edits` multipart `image[]`，但本次文档没有给出该渠道编辑协议，所以默认 `VAKV_ENABLE_IMAGE_EDITS=false`，验证后再开。图片上传、校验、持久化和归属检查已经实现。

请求强制 `response_format=b64_json`，仅接受一张 base64 结果。当前不下载任意服务商返回 URL，防止未配置外部存储域名变为 SSRF；只返回 URL 的渠道会进入待核对，不自动重发。没有伪造异步 provider task ID 或轮询能力。

## 服务端配置与启动

旧线上架构为 Pages + Hono Workers API + Queues 消费者 + R2 + Supabase，旧服务仍运行，但仓库中的 Cloudflare 生产发布配置已删除。新目标为 CloudBase，部署凭据、私有存储及共享 PG 迁移边界见 [CloudBase 部署](cloudbase-deployment.md)。供应商和资源密钥只保留在服务端；静态前端发布不代表 API 与消费者已迁移。

账号通过现有企业账号体系配置，主子账号共用组织钱包。生成开关默认关闭，确认数据库、权限、对象存储、模型及后台绑定后再显式启用 `IMAGE_GENERATION_ENABLED=true`。本地开发使用 Wrangler 模拟与独立 loopback 数据库，真实模型调用需显式 `LOCAL_IMAGE_GENERATION_ENABLED=true`。旧 Node 工作台签发脚本仅供已有的本地调试，不是线上账号注册或充值接口。

每张固定 20 币，忽略旧 `IMAGE_CREDITS_PER_IMAGE` 定价；提交扣费、确定失败按张退款。充值订单与账务只读接口已接入，真实支付未接入，见 [企业钱包](enterprise-wallet.md)。

## API

所有 JSON 响应遵循 [统一返回格式](api-response.md)，原业务结果放入顶层 data；错误使用 request_id、数字业务码和中文 message。未验证身份返回 401，跨组织资源返回 404。API 客户端使用 `Authorization: Bearer <LycoBo 访问令牌>`（不是 Vakv 密钥）；浏览器支持企业 JWT HttpOnly Cookie，不开放凭证通配 CORS。图片内容接口保留二进制响应。

| 方法与路径 | 功能 |
| --- | --- |
| GET /api/v1/image-models | 三个公开模型、文档能力、实际启用档位与每张积分；enabled 仅代表配置开关，不代表 Worker 在线 |
| POST /api/v1/image-tasks | 创建任务，原子保存任务/图片项/outbox/积分预留，202；同 key 同参数重放返回 200 |
| GET /api/v1/image-tasks?limit=20&before=任务UUID | 组织内任务列表，按创建时间/ID 倒序，最大 100 条 |
| GET /api/v1/image-tasks/:id | 组织内任务、输入快照、逐图状态与输出元数据 |
| POST /api/v1/image-assets | 原始 PNG/JPEG/WebP 文件体，最大 10MB，返回资产 ID 与实际尺寸 |
| GET /api/v1/image-assets?limit=30&before=资产UUID&kind=output&type=image | 组织内素材列表；可选kind=output/reference区分来源，type=image/video/audio区分媒体类型，均在分页前筛选；省略筛选保持兼容。当前生成和存储仅接入图片，type来自media_assets.media_type，旧记录及新图片默认image；public_id为图片编号，task_public_id为生成任务编号，参考图无所属生成任务时为null |
| GET /api/v1/image-assets/:id/content | 启用独立资源域名后，仅鉴权并重定向到签名链接；本地兼容读取 |
| GET /api/v1/image-assets/:id/delivery | 身份与组织验证后按需刷新原图、缩略图与下载链接 |
| POST /api/v1/image-tasks/:jobId/items/:itemId/reconcile-failure | 管理员核对服务商后确认未成功，释放预留积分；不重发模型请求 |

提交示例（TOKEN 为上一步本地签发的应用访问令牌）：

```sh
curl http://127.0.0.1:8787/api/v1/image-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 4cbaf693-df1d-44c7-838b-3dd1aa802d58' \
  -d '{"model":"gpt-image-2","prompt":"米白陶瓷杯，阳光木桌场景","resolution":"1K","aspectRatio":"1:1","count":1,"referenceAssetIds":[]}'
```

查询记录会返回任务级 organization_id、user_id、model、prompt、resolution、aspect_ratio、requested_count、input、unit_credits、created_at、updated_at、completed_at，以及 items 的 worker_id、provider、provider_request_id、attempts、started_at、completed_at、output_asset_id、width、height、bytes、error_code。缺少服务商请求 ID 时保留 null，不用本地 ID 冒充。

服务端原图信息还保存在 media_assets：object_key、mime_type、bytes、width、height、sha256、组织、用户和创建时间。参考上传原文件上限 10MB；生成结果和规范化 PNG 上限 32MB，服务商 JSON 响应上限 45MB，避免高分辨率结果沿用上传体积限制。图片字节保存在私有 R2，以服务端解析的 UID 分目录；数据库保存元数据和关联，不塞入 JSON 或队列消息。

## 任务与计费边界

- generation_jobs 保存输入和逐图价格快照；generation_job_items 保存执行实例、租约和图片关联。
- 同一组织/用户/Idempotency-Key 保持同一任务；换参数重放返回 409，数据库余额不足返回 409，均不产生付费请求。
- 任务、全部图片项、每图 outbox 和积分预留位于同一 PostgreSQL 事务。HTTP 事务不发消息或调用服务商；提交后只触发 outbox 投递。
- 投递器从 PostgreSQL 租赁 outbox，事务外投递 Cloudflare Queues，发送成功后确认；消息只含 version 和 itemId，消费者由数据库领取与执行令牌再次保护。
- outbox 最早 30 秒后可重新租赁，API 提交后即时投递、Cron 每分钟补偿，可恢复消息丢失或投递确认中断。running 不回到 queued，重复消息不重复调用模型。
- CloudBase 没有队列推送：API 提交或重试成功后同步唤醒消费者函数，消费者只用运行角色排队一次异步 drain 后立即返回，付费请求不在同步调用中执行；仍在排队的任务被轮询时最多每 15 秒补唤醒一次。drain 结束时如有延后读取、未开始或满批的意向，会按到期时间自行续排；定时器始终是兜底。
- 每图独立执行与保存：成功保留扣除积分，明确拒绝退回该图积分；部分失败不删除成功兄弟图片。积分退款有唯一约束，不重复返还。
- 超时、断连、5xx、无法验证的响应、图片结果保存异常或执行租约到期，进入 needs_reconciliation，额度继续预留；不能靠队列重试重复付费。
- 服务商没有文档化幂等/查询协议。虽然发送稳定 Idempotency-Key 请求头，但不将其视为上游保证，不自动重试付费调用。
- 管理员必须先核对服务商记录，再提交 `{"verifiedFailed":true,"evidence":"服务商记录核对依据..."}` 确认失败。该接口记录核对人和依据，释放额度一次，不自动重新生成。实际已成功但本地无法入库的结果需要运维恢复文件/数据库，不可确认成未成功。
- 请求成功但进程在文件落盘与数据库提交之间退出可能留下孤立文件；任务会保留待核对，需运维核对后恢复或清理。当前没有自动成功结果恢复、计费回调或支付网关。
- 没有提供自动重发、公共注册、组织管理、成员邀请、在线充值、自动清理。不要将服务端接入等同于生产上线。

## 验证与迁移

- `pnpm check`：类型、lint、单元测试和生产构建。
- `ALLOW_LOCAL_INTEGRATION=true DATABASE_URL=... pnpm test:integration`：仅 loopback 的隔离 PostgreSQL 和本地 workerd Queues/R2，含已有诊断约束与新生图完整链路。通过本地 HTTP fixture 验证，不使用真实 key，不扣服务商积分。
- 新集成覆盖访问令牌、伪造身份、组织隔离、参考图越权、并发幂等、积分预留/释放、实际文件与元数据、重复队列消息、部分失败、服务商不确定结果、Worker 租约到期和令牌撤销。
- 新增 `0002_fuzzy_wolverine.sql` 与对应 Drizzle snapshot/journal；保留已合并的 0000/0001。它基于远端 dev 的迁移顺序，不包含主工作区未跟踪的其他 0002 草稿，合并前必须协调迁移编号。
- 真实渠道的 1K/2K/4K 输出像素、参考编辑以及 flare/sunburst 支持范围需在配置密钥后另行限额验收。模拟图片或静态页面不作为真实渠道证据。

## 当前工作台接入与实测（2026-10-20）

- `/create` 已调用真实提交接口；支持纯文生图，参考图先上传并校验，再以资产 ID 提交。所有新草稿默认 1K。
- gpt-image-2、gpt-image-2-4K、gpt-image-2.5、gpt-image-2.5-flare、gpt-image-2.5-sunburst 各一次真实 1K 调用均成功；4K 模型该次实际为 1024×1024，其余四个为 1254×1254。请求档位与返回像素分别保存。
- gpt-image-2.5 的单参考图编辑另做一次真实调用成功。其余模型的编辑、高分辨率及非方形尺寸未逐一实测，不扩大为已验收能力。
- 2.5 系列按用户要求开放 1K 路由，保留能力来源标记；2K/4K 默认不开放。参考编辑使用 OpenAI 兼容 `/v1/images/edits` 协议，需启用 `VAKV_ENABLE_IMAGE_EDITS`。
- 历史、右侧索引与素材库不轮询列表；只有可见页面中存在排队或生成中的任务时才按任务详情查询，状态通过 SSE 或这些查询定向更新缓存；支持游标加载更多。列表使用提前生成的 512px 缩略图，下载读取原图。
- 提交响应不确定时，浏览器会按用户和组织在 sessionStorage 保留同一请求快照与幂等编号，刷新后通过“确认上次提交”复用请求；不会自动重新生成。已运行但结果不确定的任务不自动重发；用户可以明确确认后在原记录重试，先结束旧尝试并退回原扣款，再提交新尝试，操作与未知结果依据可审计。管理员核对入口仍保留。
- `GET /api/v1/image-assets?limit=30&before=UUID` 返回组织内素材与短期签名链接；历史输出和参考图同时返回链接。API 批量解析组织范围内的对象位置，不逐图查询数据库。独立资源 Worker 验签、校验 Referer／Origin，先读缓存、未命中时流式读取私有 R2，不执行图片转换。上传与生成结果在入库前保存原图及缩略图；旧 content 链接兼容重定向。具体配置与域名验收边界见 Cloudflare 部署文档。

### 本地启动

在根目录 `.env` 填写 `VAKV_API_KEY`。API key 不使用 VITE 前缀、不进入浏览器或 Git。
首次配置数据库后执行迁移与本地身份签发：

```sh
pnpm infra:up
pnpm db:migrate
pnpm --filter @lycoboai/api images:setup
pnpm dev
```

`images:setup` 仅供本机开发：生成数据库成员身份与 7 天应用令牌，将令牌、持久图片目录及开关写入 `.env`，不打印令牌、不覆盖 Vakv key。续期复用原组织、历史与剩余额度；初始化额度是内部开发配额，不是充值或服务商货币余额。
目标数据库以本地 `.env` 的 `DATABASE_URL` 为准，Compose 对应 `IMAGE_COMPOSE_DATABASE_URL`。首次配置前核对数据库；setup 复用可用身份或原有本地组织，不因重启重新初始化额度。不要用 `.env.example` 覆盖已有身份和启用开关。

本地浏览器通过 `POST /api/v1/image-session` 换取 HttpOnly、SameSite=Strict Cookie。仅 NODE_ENV=development 且配置应用令牌时开放，Origin 必须是明确配置的 localhost/127.0.0.1；Cookie 写请求同样校验 Origin。服务端从数据库解析用户和组织。正式用户登录、团队邀请尚未接入，不能把该本地会话方式部署为公开注册系统。

也可 `docker compose up -d --build --wait`：8080 为网页，8788 为容器 API 的本地端口，避免和 pnpm 的 8787 冲突。API 与 Worker 挂载同一 `data/images` 目录，读取同一数据库与队列；`.env` 中的 `IMAGE_COMPOSE_DATABASE_URL` 由 setup 命令配置。修改 `.env` 后需重建服务配置或重启本地进程；不要把提供商 key 写到前端。

浏览器通过 8080 工作台额外提交的一次 gpt-image-2 请求收到无法按图片协议解析的响应，任务 `8c2aeb53-4856-4da4-b85c-9e90d1909139` 已进入 needs_reconciliation，保留额度并等待服务商核对，没有自动重发。不能将这次调用计入成功数。

### 本地配置恢复验收（2026-10-20）

本次检查时 `.env` 缺少工作台身份且生图开关为 false，当前 PostgreSQL 的 `lycoboai` 数据库尚无生图表。执行已有迁移和 `images:setup` 后，API 与 Worker 使用同一数据库及 `data/images`，生图开关为 true，工作台会话验证通过，Worker 已启动。

一次 gpt-image-2、1K、1:1、单图真实验收任务 `c8721224-53b2-4d0c-9d32-60e906527bbb` 已从 queued 进入 running，实际尝试一次。服务商请求 ID 为 `8c0f8d42`，响应未通过当前单张 base64 图片协议校验，错误码 `PROVIDER_INVALID_IMAGE_RESPONSE`，最终为 needs_reconciliation，没有输出资产，也没有重发或按失败退款。需在服务商控制台核对该请求的结果与消耗；本次仅证明提交、持久化和消费链路可用，不能计为生图成功。

## 企业账号身份

企业密码登录与 JWT 已接入，配置、Cookie／Bearer、安全边界与创建账号见 [企业鉴权](enterprise-auth.md)。启用后浏览器不再自动使用本地工作台身份；既有服务端 API key 保持兼容。

## 图片质量参数

`POST /api/v1/image-tasks` 支持可选 `quality: "low" | "medium" | "high"`，对应界面「低／标准／高」。新提交从草稿发送该字段，非法值返回 400 及统一错误信封；参数由服务端契约校验。

任务 input JSON 快照保存质量，Worker 文生图 JSON 和图生图 multipart 均传递同名参数；编辑历史任务恢复对应选择，重新生成沿用原任务快照。不同质量属于不同输入，不能复用同一个幂等键覆盖已有任务。

兼容旧客户端及旧任务：缺省 quality 在解析后仍保持字段缺省，以保留旧任务的输入哈希；供应商调用时缺省按 medium，界面恢复为「标准」。无需数据库迁移，现有任务 input JSON 已支持保存此字段。

本轮验证使用本地供应商请求 fixture，未调用付费服务；Vakv 各模型是否实际执行对应质量及成本差异，仍需服务商确认或另行授权实测。当前积分预留仍按现有每张配置，不能据此声称质量间成本相同。

## 用户可见的任务与图片编号

用户对外 UID 为随机 10 位纯数字字符串（允许首位为 0）。任务编号为 `W` + 8 位 `0–9A–Z`，例如 `W07AZ9T2Q`；生成图及素材编号为 `P` + 8 位 `0–9A–Z`，例如 `P82ZX19M4`。用户 UID 不编码进任务或图片编号，避免暴露关联和注册数量。API 任务 `public_id`、结果项 `output_public_id`、素材 `public_id` 返回这些字符串；原 UUID 主键、外键、路由及 Worker 进程 ID 保留。

迁移 0005 在 0004 基础上新增随机编号列和 `public_identifiers` 登记表。数据库函数使用 `gen_random_uuid()` 的随机字节、跳过固定版本位，并用拒绝采样避免字符分布偏差；通过登记表主键原子预留号码，碰撞最多重新分配 32 次。业务表另有唯一约束与登记表外键。分配失败会中止当前事务，不会重试付费生图请求。记录删除后仍保留已提交编号的登记，避免重新使用。

迁移为历史记录重新分配新格式编号；旧数字任务号及 L 图片号登记为退役号码，旧 display_number 列保留以兼容旧部署。客户端兼容读取旧格式及缺省字段，新增数据使用新格式。必须先部署迁移，再部署 API／Worker；内部路由及授权始终通过 UUID 与服务端成员关系执行，公开编号不是权限凭证。

10 位数字空间为 100 亿个值，8 位 36 进制空间每类为 36^8 个值；容量有限，数据库唯一约束确保成功提交的数据不重复。备份恢复必须保留登记表，多库合并需要协调，不能承诺任意独立数据库或丢失历史登记后也永不重复。不要把 UID 解析为数字，否则会丢失前导 0。

## 失败任务的主动重新生成

失败预览默认显示“失败”，悬停／键盘聚焦时切换“重试”。大图重试、右侧历史失败缩略图及任务旁“重新生成”均打开 HeroUI 确认弹窗，确认后按原任务快照发起新任务。failed、partially_failed、needs_reconciliation 允许用户主动确认新建任务；不会把原任务改为排队、自动重发原服务商请求或修改原计费状态。队列中／生成中任务及当前会话未确认提交仍阻止重复提交，模型与额度继续由现有服务端规则验证。

## 历史记录刷新策略

工作台历史与右侧索引共享 TanStack Query 缓存，不定时刷新列表。历史、素材和登录状态仅在首次加载、用户操作、过期数据恢复焦点及任务状态变化后查询；提交成功后主动刷新相关缓存。缓存新鲜期为 30 秒，减少重复挂载请求。请求失败只在顶部弹出 danger toast，恢复后重新进入页面可重新请求。

StudioShell 只轮询缓存中排队或生成中的任务详情（含局部修图任务），页面隐藏时暂停，回到前台立即查询一次。最新任务创建不足 2 分钟时每 4 秒、10 分钟内每 10 秒、更久时每 30 秒查询一次，连续失败按倍数退避至 60 秒；有 SSE 时同一循环仅每 30 秒兜底。详情未变化时不写缓存；变化后定向替换历史页中的任务，新增尝试或新失败（退款）才刷新钱包，新输出才刷新素材，任务已删除或不在已加载页时刷新历史。没有未完成任务时不发请求，空闲页面不会访问 API 或数据库。

## SSE 实时通知（2026-10-21）

`GET /api/v1/image-events` 使用现有 Cookie／Bearer 身份；事件范围与任务、素材读取一致，由服务端解析组织成员关系。`image-models` 增加可选 `eventsEnabled`，用于兼容旧部署。SSE 响应为 `text/event-stream`，不包装 JSON 信封；鉴权、参数和服务不可用错误仍使用统一信封。支持 Last-Event-ID 请求头或非敏感 cursor 查询参数，游标为十进制 bigint 字符串。

通知链路为 PostgreSQL generation_events 持久化日志＋事务内 NOTIFY＋API 进程级 LISTEN＋SSE，Workers 通过组织范围的日志轮询维持 SSE；Queues 承载生图任务，不使用 Redis。提交、开始、每张结果、租约到期与人工核对、参考图上传在对应事务末尾写事件，回滚不留事件或通知。每组织事务级 advisory lock 在事件追加前获取，确保同一组织已提交游标顺序，不把并发事务的序列分配顺序误当成提交顺序；锁后只追加事件并提交，不调用外部服务。事件只含编号、类型和资源 UUID，不保存提示词、图片内容、凭据或供应商响应。

每个 API 进程共用一个专用 LISTEN 连接和固定大小查询池，不为每个浏览器占一条数据库连接。原生通知仅作唤醒，实际内容从持久化日志读取；监听自动恢复后唤醒已有连接补读。支持 ready、image.updated、resync、heartbeat、auth-expired 事件。正常事件带 id；ready／resync 要求客户端重新校准现有列表，超过 200 条补读时转为快照校准。Worker 每小时最多清理 1000 条超过 7 天的事件；旧游标重连仍校准快照。

连接每 15 秒心跳，空闲时每分钟验证会话，每次实际补发事件前再次鉴权。会话失效发送 auth-expired 并关闭；连接最长 10 分钟，客户端带游标重连。每个用户每 API 实例最多 8 条连接，断开／流错误／关闭进程时释放监听和定时器。事件流断开不取消、不重发 Worker 中的生图请求。

前端在 StudioShell 维护每页一条共享 EventSource，HttpOnly Cookie 自动携带，不把 Token 放在 URL。ready／resync／重新打开连接后校准历史与素材；同一任务的事件按 150ms 合并，获取该任务详情并更新共享 Query 缓存，未知任务再刷新列表，有输出时更新素材。游标用于去重，串行合并避免旧任务请求回写覆盖新结果。退出和身份切换关闭旧连接。历史、素材、登录状态与局部修图均不再定时轮询。局部修图与通知共用任务详情缓存；ready／resync 校准已打开的任务详情。连接失败时仅对 SSE 指数退避重连至 30 秒，连续稳定连接满 60 秒后才重置退避，避免短暂 ready 后反复快速重连；重连成功后校准断线期间的状态。未完成任务另有每 30 秒一次的详情兜底查询，防止事件丢失后停在生成中。

部署顺序：先执行迁移 0007，再更新 API 与 Worker，最后前端。`IMAGE_EVENTS_ENABLED=false` 可关闭实时通道；CloudBase 后端默认关闭，仅在显式设为 `true` 时开启，因为 HTTP 云函数按连接时长计费，事件轮询也会让共享 PostgreSQL 持续计量；生产网关需支持流式响应、关闭 SSE 路径的代理缓冲，空闲超时大于心跳间隔，建议 HTTP/2。健康检查仍使用短请求。LISTEN 需要可保留会话的数据库连接，不能经 transaction 模式连接池。

验证：`ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:events` 在专用临时数据库执行迁移，验证隔离、提交／回滚、独立监听连接、任务生命周期、游标回放、撤销后停止发送。浏览器 fixture 验证共享连接、停止轮询、定向更新、去重、重连与断线期间不轮询；不调用付费模型。

## 当前公开模型（2026-10-21）

前台仅显示 gpt-image-2、gpt-image-2.5、nano-banana-2.1；旧供应商ID保留历史兼容。最新映射、账务及迁移发布顺序以 [企业钱包](enterprise-wallet.md) 为准。

## 生图耗时诊断（2026-10-21）

Worker 以 `Image generation stage timing` 输出结构化分段计时，包含 itemId、stage、durationMs，必要时包含响应字节数与 HTTP 状态码。禁止输出提示词、参考图、响应正文、凭据或签名 URL。

- claim / reference_read：领取任务与参考图片读取。
- provider_request_started / provider_headers：开始请求与收到响应头；此段包含连接、上传、网关等待和模型执行，不能直接等同于模型推理时间。
- provider_body / provider_decode：响应体接收与 base64 解码。
- image_storage / database_finish：图片解码编码落盘与完成事务。
- provider_complete / item_complete：供应商调用总耗时与本次处理总耗时，和子阶段重叠，不相加。
- provider_error / provider_timeout：供应商请求异常或达到总超时上限前的累计耗时。日志接收器异常不能影响付费结果或触发重试。

默认10分钟配置是单次供应商请求（包含响应体接收）的总超时上限，不是固定等待；可通过GENERATION_TIMEOUT_MS调整，范围1秒–10分钟，领取租约覆盖总超时再加60秒。超时单独记录PROVIDER_TIMEOUT与provider_timeout计时，状态仍为needs_reconciliation，不自动重发或退款；前端使用SSE接收完成事件。已有历史任务只有开始/结束时间，无法事后恢复分段耗时。供应商控制台显示的耗时应使用同一请求的时间/ID核对，不能直接当作客户端端到端耗时。

### 单次真实诊断结果：W174YOWZN

用户授权沿用 WYVM6UO9A 生成1张、扣20币。2026-10-21 北京时间17:26提交；只执行一次，不重发。

| 阶段 | 实测 |
| --- | --- |
| 领取任务 | 67ms |
| 参考图读取 | 14ms |
| 请求开始到响应头 | 63,719ms |
| 响应体接收 | 209,034ms，3,290,644字节 |
| 调用累计至校验失败 | 272,962ms |

供应商控制台对应记录显示59秒、1张、medium；请求ID为 `202610210926065370041478268d9d6fUy0bGng`，上游ID为 `202610210926094198655368268d9d6mu9rqejz`。供应商耗时不包含客户端完整接收图片的209秒；已确认主要额外等待在响应体接收，未能仅凭这些证据进一步区分供应商发送限速、链路拥塞或本机网络转发。

公网同源5MB静态资源对照发现速度明显波动；显式本机代理和Accept-Encoding调整均没有稳定改善，因此未修改全局代理、固定IP或盲目切换生成接口。不能宣称吞吐问题已修复。

本次响应未通过图片结构或base64校验，状态保持 needs_reconciliation，没有保存成功图片，也没有自动重试/退费。旧日志没有保存响应正文，不能追溯具体格式差异。后续新增 provider_invalid_response_shape / provider_invalid_base64 安全分类，并兼容供应商 X-Oneapi-Request-Id 响应头，便于对照上游日志；不记录图片内容。

## 单图重试

`POST /image-tasks/:jobId/retry` 支持可选JSON字段 `itemId`，仍要求Idempotency-Key与身份验证。省略字段兼容旧客户端整批重试（旧客户端发送的完整input仍忽略，执行始终读取服务端存储输入）；传入时仅允许当前任务未被替代的failed／needs_reconciliation项，其他图片可以继续排队或执行。已成功图片不可通过此入口重试，异步旧尝试完成不会覆盖新尝试。

事务内按既有任务／子项锁顺序校验归属，必要时退休未决尝试并记录操作者，按原单价退款／重新扣款一次，只新增当前position的子项与outbox。generation_retries.target_item_id将幂等键绑定具体目标，重复请求回放，同键换图或切换批量被拒绝；旧行NULL不改变批量语义。丢失响应时浏览器保留retryJobId／retryItemId与原幂等键，刷新后确认原请求。迁移0018须先于API启用此功能，线上发布仍需单独授权。

任务SSE更新不再无条件刷新钱包：已有图片的排队、执行中、成功及重复事件不改变预付余额；只在发现新尝试或新增明确失败（退款）时刷新钱包和账单，并用500ms窗口合并密集变更。连接恢复／resync仍校准完整状态，提交成功仍刷新扣款。

### 2026-10-27 本地4K参考编辑诊断

用户授权本地企业账号仅测试1张、最多20积分，不自动重试。通过真实登录与任务提交接口创建 `WRL2WPUQ8`，固定 `gpt-image-2-4K`、4K／1:1、4张已有参考图，实际调用 `https://api.vakv.cn/v1/images/edits`。没有打印提示词、图片、密钥、Cookie、签名URL或上游响应正文。

- Asia/Shanghai 11:23:16 开始执行，参考图读取29ms。
- 供应商响应头等待80719ms，HTTP 200；上游请求ID为 `32f0930f-a079-43ac-9a64-48c6f0241359`。
- 到600006ms仍未读完响应体，11:33:16结束为 `needs_reconciliation / PROVIDER_TIMEOUT`，未进入图片解码与存储完成阶段。
- 本地账本仅1笔20积分扣款，未知结果保留待核对；未自动退还或再次提交。
- 从同一容器只读调用 `/v1/models` 返回200并包含该模型；Worker配置与本地 `.env` 的接口地址／密钥一致，令牌未过期。这些检查只证明连通性和目录可用，不代表生图成功。

这次证据确认请求到达上游并收到了响应头，不能将后台日志为空等同于没有发送请求。仍需供应商按上述请求ID核查对应编辑渠道的执行状态、响应体是否完成、是否支持所选模型与参数，以及为何用户后台没有显示这条调用；目前没有足够证据断定具体的上游失败原因。不要把HTTP 200、模型列表可用或fixture测试当作真实4K参考编辑验收。

## 历史记录删除

`DELETE /api/v1/image-tasks/:id` 复用企业会话、可信来源保护与组织隔离，成功返回 `{id}`（统一 envelope），重复删除幂等；其他组织或未知 ID 返回404。迁移0025为 `generation_jobs` 添加可空 `archived_at`；历史查询排除归档记录，并通过持久任务事件通知其他会话。删除仅归档历史展示，不删除素材、任务详情、outbox或账本，不取消执行、不重试、不退款。部署时先迁移再更新 API。前端右侧卡片使用共享确认弹框与错误Toast。
