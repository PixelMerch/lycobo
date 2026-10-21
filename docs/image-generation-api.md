# Vakv 生图 API、队列与持久化

生图服务已接到当前工作台；服务端默认关闭，需显式配置后启用。本地真实调用验收见文末。
接口以组织为数据边界，用户身份来自服务端验证的访问令牌与数据库成员关系；请求体不得提供 userId、organizationId 或 workerId。
既有 `/api/v1/tasks` 契约和前端演示保持原状，新接口使用独立路径与新增数据库表。

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

1. 在工作树根目录复制 `.env.example` 为 `.env`，填写 `DATABASE_URL`、`REDIS_URL`、`VAKV_API_KEY`。
2. 设置 `IMAGE_DATA_DIR` 为绝对路径。API 和 Worker 必须使用同一持久目录/共享卷；不要放在 web/public 或容器临时层。当前实现是私有本地文件存储，不是 S3，也不支持多机独立磁盘。
3. 评审新增迁移后执行 `pnpm db:migrate`。不自动修改已有数据库，不使用 db push。
4. 创建本地运维接入身份与额度：

```sh
IMAGE_ADMIN_SUBJECT=existing-auth-subject \
IMAGE_ORGANIZATION_NAME=merchant-team \
IMAGE_INITIAL_CREDITS=20 \
pnpm --filter @lycoboai/api images:provision
```

脚本每次创建新组织，复用同 auth_subject 用户，并输出 userId、organizationId、keyId 和一次生成的访问令牌。令牌有效期 7 天，数据库只保存 SHA-256 摘要，不记录明文。妥善保管输出，不上传日志或 Git。该工具只供有数据库权限的运维使用，不是公开注册/充值接口。撤销令牌需由运维更新对应 image_api_keys.revoked_at；用户登录和团队邀请仍需对接正式身份系统。

5. 在 `.env` 显式设置 `IMAGE_GENERATION_ENABLED=true`、`IMAGE_WORKER_ENABLED=true`。保持 diagnostic 的 `WORKER_ENABLED` 独立；只跑生图时它可以为 false。
6. 分别启动 API 与 Worker：

```sh
pnpm --filter @lycoboai/api dev
pnpm dev:worker
```

Worker 缺少密钥/数据库/Redis 时启动失败，不以演示结果代替。API 本身不调用模型，也不把服务商密钥发给浏览器。
当前每张固定20币，忽略旧 `IMAGE_CREDITS_PER_IMAGE` 定价。主子账号使用同一个组织钱包，提交扣费、确定失败按张退回。充值订单与账务只读接口已接入，真实支付未接入。详见 [企业钱包与模型路由](enterprise-wallet.md)。

## API

所有 JSON 响应遵循 [统一返回格式](api-response.md)，原业务结果放入顶层 data；错误使用 request_id、数字业务码和中文 message。未验证身份返回 401，跨组织资源返回 404。API 客户端使用 `Authorization: Bearer <LycoBo 访问令牌>`（不是 Vakv 密钥）；浏览器支持企业 JWT HttpOnly Cookie，不开放凭证通配 CORS。图片内容接口保留二进制响应。

| 方法与路径 | 功能 |
| --- | --- |
| GET /api/v1/image-models | 五个模型、文档能力、实际启用档位与每张积分；enabled 仅代表配置开关，不代表 Worker 在线 |
| POST /api/v1/image-tasks | 创建任务，原子保存任务/图片项/outbox/积分预留，202；同 key 同参数重放返回 200 |
| GET /api/v1/image-tasks?limit=20&before=任务UUID | 组织内任务列表，按创建时间/ID 倒序，最大 100 条 |
| GET /api/v1/image-tasks/:id | 组织内任务、输入快照、逐图状态与输出元数据 |
| POST /api/v1/image-assets | 原始 PNG/JPEG/WebP 文件体，最大 10MB，返回资产 ID 与实际尺寸 |
| GET /api/v1/image-assets/:id/content | 身份与组织验证后读取图片，不直接暴露磁盘路径 |
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

服务端原图信息还保存在 image_assets：object_key、mime_type、bytes、width、height、sha256、组织、用户和创建时间。参考上传原文件上限 10MB；生成结果和规范化 PNG 上限 32MB，服务商 JSON 响应上限 45MB，避免高分辨率结果沿用上传体积限制。图片字节保存在私有文件目录，数据库保存文件元数据和关联，不塞入 JSON 或 Redis 消息。

## 任务与计费边界

- image_jobs 保存输入和逐图价格快照；image_job_items 保存执行实例、租约和图片关联。
- 同一组织/用户/Idempotency-Key 保持同一任务；换参数重放返回 409，数据库余额不足返回 409，均不产生付费请求。
- 任务、全部图片项、每图 outbox 和积分预留位于同一 PostgreSQL 事务。提交端不直接发 Redis 或调用服务商。
- Worker 从 PostgreSQL 租赁 outbox，事务外投递 BullMQ，投递后确认。消息只含 itemId，队列使用独立名字；并发执行由数据库领取与执行令牌再次保护。
- outbox 每 30 秒重新检查仍 queued 的图片项，可恢复 Redis 丢失或投递确认中断。running 不回到 queued，重复消息不重复调用模型。
- 每图独立执行与保存：成功保留扣除积分，明确拒绝退回该图积分；部分失败不删除成功兄弟图片。积分退款有唯一约束，不重复返还。
- 超时、断连、5xx、无法验证的响应、图片结果保存异常或执行租约到期，进入 needs_reconciliation，额度继续预留；不能靠队列重试重复付费。
- 服务商没有文档化幂等/查询协议。虽然发送稳定 Idempotency-Key 请求头，但不将其视为上游保证，不自动重试付费调用。
- 管理员必须先核对服务商记录，再提交 `{"verifiedFailed":true,"evidence":"服务商记录核对依据..."}` 确认失败。该接口记录核对人和依据，释放额度一次，不自动重新生成。实际已成功但本地无法入库的结果需要运维恢复文件/数据库，不可确认成未成功。
- 请求成功但进程在文件落盘与数据库提交之间退出可能留下孤立文件；任务会保留待核对，需运维核对后恢复或清理。当前没有自动成功结果恢复、计费回调或支付网关。
- 没有提供自动重发、公共注册、组织管理、成员邀请、在线充值、SSE、对象存储签名 URL 或自动清理。不要将服务端接入等同于生产上线。

## 验证与迁移

- `pnpm check`：类型、lint、单元测试和生产构建。
- `ALLOW_LOCAL_INTEGRATION=true DATABASE_URL=... REDIS_URL=... pnpm test:integration`：仅 loopback 的隔离 PostgreSQL/Redis，含已有诊断约束与新生图完整链路。通过本地 HTTP fixture 验证，不使用真实 key，不扣服务商积分。
- 新集成覆盖访问令牌、伪造身份、组织隔离、参考图越权、并发幂等、积分预留/释放、实际文件与元数据、重复队列消息、部分失败、服务商不确定结果、Worker 租约到期和令牌撤销。
- 新增 `0002_fuzzy_wolverine.sql` 与对应 Drizzle snapshot/journal；保留已合并的 0000/0001。它基于远端 dev 的迁移顺序，不包含主工作区未跟踪的其他 0002 草稿，合并前必须协调迁移编号。
- 真实渠道的 1K/2K/4K 输出像素、参考编辑以及 flare/sunburst 支持范围需在配置密钥后另行限额验收。模拟图片或静态页面不作为真实渠道证据。

## 当前工作台接入与实测（2026-10-20）

- `/create` 已调用真实提交接口；支持纯文生图，参考图先上传并校验，再以资产 ID 提交。所有新草稿默认 1K。
- gpt-image-2、gpt-image-2-4K、gpt-image-2.5、gpt-image-2.5-flare、gpt-image-2.5-sunburst 各一次真实 1K 调用均成功；4K 模型该次实际为 1024×1024，其余四个为 1254×1254。请求档位与返回像素分别保存。
- gpt-image-2.5 的单参考图编辑另做一次真实调用成功。其余模型的编辑、高分辨率及非方形尺寸未逐一实测，不扩大为已验收能力。
- 2.5 系列按用户要求开放 1K 路由，保留能力来源标记；2K/4K 默认不开放。参考编辑使用 OpenAI 兼容 `/v1/images/edits` 协议，需启用 `VAKV_ENABLE_IMAGE_EDITS`。
- 历史记录、任务中心、右侧索引每 3 秒查询数据库任务；素材库每 5 秒查询已保存资产。两者都支持游标加载更多。列表使用鉴权后 512px 缩略图，下载读取原图。
- 提交响应不确定时，浏览器会按用户和组织在 sessionStorage 保留同一请求快照与幂等编号，刷新后通过“确认上次提交”复用请求；不会自动重新生成。已运行但结果不确定的任务仍需运维核对。
- 新增 `GET /api/v1/image-assets?limit=30&before=UUID`，返回组织内资产元数据；`content?thumbnail=1` 返回缩略图。原图与缩略图均验证组织归属。

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

工作台历史与右侧索引共享 TanStack Query 缓存，由历史区统一驱动轮询，索引不启动独立定时器。仅当已加载记录存在 queued／running 任务时每 3 秒刷新；全部任务结束、空历史或请求失败后停止定时请求，后台标签页不持续轮询。缓存新鲜期为 30 秒，减少重复挂载请求；登录切换、新任务提交、恢复焦点后的过期数据仍通过现有机制自动更新，不依赖无条件轮询。请求失败只在顶部弹出 danger toast，页面不显示错误文案或重新连接按钮，恢复后重新进入页面即重新请求。

## SSE 实时通知（2026-10-21）

`GET /api/v1/image-events` 使用现有 Cookie／Bearer 身份；事件范围与任务、素材读取一致，由服务端解析组织成员关系。`image-models` 增加可选 `eventsEnabled`，用于兼容旧部署。SSE 响应为 `text/event-stream`，不包装 JSON 信封；鉴权、参数和服务不可用错误仍使用统一信封。支持 Last-Event-ID 请求头或非敏感 cursor 查询参数，游标为十进制 bigint 字符串。

通知链路为 PostgreSQL image_events 持久化日志＋事务内 NOTIFY＋API 进程级 LISTEN＋SSE，不新增 Redis 转发；Redis/BullMQ 继续承载生图任务。提交、开始、每张结果、租约到期与人工核对、参考图上传在对应事务末尾写事件，回滚不留事件或通知。每组织事务级 advisory lock 在事件追加前获取，确保同一组织已提交游标顺序，不把并发事务的序列分配顺序误当成提交顺序；锁后只追加事件并提交，不调用外部服务。事件只含编号、类型和资源 UUID，不保存提示词、图片内容、凭据或供应商响应。

每个 API 进程共用一个专用 LISTEN 连接和固定大小查询池，不为每个浏览器占一条数据库连接。原生通知仅作唤醒，实际内容从持久化日志读取；监听自动恢复后唤醒已有连接补读。支持 ready、image.updated、resync、heartbeat、auth-expired 事件。正常事件带 id；ready／resync 要求客户端重新校准现有列表，超过 200 条补读时转为快照校准。Worker 每小时最多清理 1000 条超过 7 天的事件；旧游标重连仍校准快照。

连接每 15 秒心跳，空闲时每分钟验证会话，每次实际补发事件前再次鉴权。会话失效发送 auth-expired 并关闭；连接最长 10 分钟，客户端带游标重连。每个用户每 API 实例最多 8 条连接，断开／流错误／关闭进程时释放监听和定时器。事件流断开不取消、不重发 Worker 中的生图请求。

前端在 StudioShell 维护每页一条共享 EventSource，HttpOnly Cookie 自动携带，不把 Token 放在 URL。ready／resync／重新打开连接后校准历史与素材；同一任务的事件按 150ms 合并，获取该任务详情并更新共享 Query 缓存，未知任务再刷新列表，有输出时更新素材。游标用于去重，串行合并避免旧任务请求回写覆盖新结果。退出和身份切换关闭旧连接。正常 SSE 下关闭历史及素材轮询；连接失败时指数退避至 30 秒，并在有进行中任务时按 30 秒兜底刷新。旧 API 未返回 eventsEnabled 时暂保留旧版刷新策略，部署新 API 后自动采用推送。

部署顺序：先执行迁移 0007，再更新 API 与 Worker，最后前端。`IMAGE_EVENTS_ENABLED=false` 可关闭实时通道；生产网关需支持流式响应、关闭 SSE 路径的代理缓冲，空闲超时大于心跳间隔，建议 HTTP/2。健康检查仍使用短请求。LISTEN 需要可保留会话的数据库连接，不能经 transaction 模式连接池。

验证：`ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:events` 在专用临时数据库执行迁移，验证隔离、提交／回滚、独立监听连接、任务生命周期、游标回放、撤销后停止发送。浏览器 fixture 验证共享连接、停止轮询、定向更新、去重、重连与低频兜底；不调用付费模型。

## 当前公开模型（2026-10-21）

前台仅显示 gpt-image-2、gpt-image-2.5、nano-banana-2.1；旧供应商ID保留历史兼容。最新映射、账务及迁移发布顺序以 [企业钱包](enterprise-wallet.md) 为准。

## 生图耗时诊断（2026-10-21）

Worker 以 `Image generation stage timing` 输出结构化分段计时，包含 itemId、stage、durationMs，必要时包含响应字节数与 HTTP 状态码。禁止输出提示词、参考图、响应正文、凭据或签名 URL。

- claim / reference_read：领取任务与参考图片读取。
- provider_request_started / provider_headers：开始请求与收到响应头；此段包含连接、上传、网关等待和模型执行，不能直接等同于模型推理时间。
- provider_body / provider_decode：响应体接收与 base64 解码。
- image_storage / database_finish：图片解码编码落盘与完成事务。
- provider_complete / item_complete：供应商调用总耗时与本次处理总耗时，和子阶段重叠，不相加。
- provider_error：供应商请求失败前累计耗时。日志接收器异常不能影响付费结果或触发重试。

5分钟配置是请求超时上限，不是固定等待；前端使用SSE接收完成事件。已有历史任务只有开始/结束时间，无法事后恢复分段耗时。供应商控制台显示的耗时应使用同一请求的时间/ID核对，不能直接当作客户端端到端耗时。
