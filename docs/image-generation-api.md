# 生图 API、任务与持久化

接口以组织为数据边界，用户身份来自服务端验证的访问令牌与数据库成员关系；请求体不得提供 userId、organizationId 或 workerId。

## 当前最低输出档：1.5K

主站新草稿提供1.5K／2K／4K。1.5K正方形精确1254×1254；其他比例长边1254，短边四舍五入到整数。契约继续接受旧1K，已保存快照、旧任务重试及1024px结果不回写。公开选择项与兼容枚举分开，不能删除旧值导致历史无法解析。

尺寸映射共用 contracts.imageOutputDimensions；Images协议提交精确size，Gemini原生使用2K后由私有存储处理成目标像素。新1.5K结果入库存储前校验源图尺寸：允许每个方向最多15像素对齐偏差并保留实际尺寸，明显不足仍拒绝，不把低清图放大；缩略图从最终图派生，元数据与下载文件一致。渠道可设置独立1.5K上游模型，未配置时回落到旧1K映射、再回落通道默认值。发布顺序为API／Worker与后台契约在前、主站在后，旧消费者不识别新枚举。

## 服务端配置与启动

生产运行于 Cloudflare Workers：同域 Hono API、独立图片 Queue/Cron Worker、Hyperdrive PostgreSQL 与私有 R2。状态通过 Durable Objects + 可休眠 WebSocket 推送，提示词优化保留 SSE。见 [Cloudflare 部署](cloudflare-deployment.md)。

账号通过现有企业账号体系配置，主子账号共用组织钱包。生图默认启用，不再使用 IMAGE_GENERATION_ENABLED 开关；数据库、权限、对象存储、模型及后台绑定必须正确配置。本地开发继续使用隔离Node进程、私有S3和独立loopback数据库，真实模型请求使用服务端配置的密钥。旧 Node 工作台签发脚本仅供已有的本地调试，不是线上账号注册或充值接口。

每张固定 2 积分，忽略旧 `IMAGE_CREDITS_PER_IMAGE` 定价；提交扣费、确定失败按张退款。充值订单与账务只读接口已接入，真实支付未接入，见 [企业钱包](enterprise-wallet.md)。

## API

所有 JSON 响应遵循 [统一返回格式](api-response.md)，原业务结果放入顶层 data；错误使用 request_id、数字业务码和中文 message。未验证身份返回 401，跨组织资源返回 404。API 客户端使用 `Authorization: Bearer <LycoBo 访问令牌>`（不是供应商密钥）；浏览器支持企业 JWT HttpOnly Cookie，不开放凭证通配 CORS。图片内容接口保留二进制响应。

| 方法与路径                                                                                                              | 功能                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/image-models                                                                                                | 三个公开模型、文档能力、实际启用档位与每张积分；enabled 仅代表配置开关，不代表 Worker 在线                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| POST /api/v1/image-tasks                                                                                                | 创建任务，原子保存任务/图片项/outbox/积分预留，202；同 key 同参数重放返回 200                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| GET /api/v1/image-tasks?limit=20&before=任务UUID                                                                        | 组织内任务列表，按创建时间/ID 倒序，最大 100 条                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| GET /api/v1/image-tasks/:id                                                                                             | 组织内任务、输入快照、逐图状态与输出元数据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| POST /api/v1/image-assets                                                                                               | 原始 PNG/JPEG/WebP 文件体，最大 10MB，返回资产 ID 与实际尺寸                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| GET /api/v1/image-assets?limit=30&before=资产UUID&kind=output&type=image&tool=textile&model=gpt-image-2.5&favorite=true | 组织内素材列表；可选kind=output/reference区分来源，type=image/video/audio区分媒体类型，tool=create/textile/variation按所属任务的工具筛选（参考图没有任务，不会命中），model按公开模型编号筛选（服务商变体归并到公开编号），favorite=true只返回当前成员收藏的素材；全部在分页前执行，省略筛选保持兼容。当前生成和存储仅接入图片，type来自media_assets.media_type，旧记录及新图片默认image；public_id为图片编号，task_public_id为生成任务编号，参考图无所属生成任务时为null；tool为所属工具（参考图为null），favorite为当前成员是否收藏 |
| GET /api/v1/image-asset-favorites                                                                                       | 当前成员收藏的素材 ID，按收藏时间倒序，最多1000个；过期或已删除的素材不返回                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| PUT /api/v1/image-assets/:id/favorite、DELETE 同路径                                                                    | 收藏／取消收藏，幂等，返回 `{ favorite }`；素材不属于当前组织或已不可见返回404；每位成员最多收藏1000项，超出返回409 STATE_CONFLICT“最多收藏 1000 项，请先取消部分收藏”                                                                                                                                                                                                                                                                                                                                                                |
| GET /api/v1/image-assets/:id/content                                                                                    | 启用独立资源域名后，仅鉴权并重定向到签名链接；本地兼容读取                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| GET /api/v1/image-assets/:id/delivery                                                                                   | 身份与组织验证后按需刷新原图、缩略图与下载链接                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| POST /api/v1/image-tasks/:jobId/items/:itemId/reconcile-failure                                                         | 管理员核对服务商后确认未成功，释放预留积分；不重发模型请求                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

提交示例（TOKEN 为上一步本地签发的应用访问令牌）：

```sh
curl http://127.0.0.1:8787/api/v1/image-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 4cbaf693-df1d-44c7-838b-3dd1aa802d58' \
  -d '{"model":"gpt-image-2","prompt":"米白陶瓷杯，阳光木桌场景","resolution":"1K","aspectRatio":"1:1","count":1,"referenceAssetIds":[]}'
```

查询记录会返回任务级 organization_id、user_id、model、prompt、resolution、aspect_ratio、requested_count、input、unit_credits、created_at、updated_at、completed_at，以及 items 的 worker_id、provider、provider_request_id、attempts、started_at、completed_at、output_asset_id、width、height、bytes、error_code。缺少服务商请求 ID 时保留 null，不用本地 ID 冒充。

服务端原图信息还保存在 media_assets：object_key、mime_type、bytes、width、height、sha256、组织、用户和创建时间。参考图上传接口请求体上限 10 MB，浏览器选图上限 50 MB；生成结果和规范化 PNG 上限 32MB，服务商 JSON 响应上限 45MB，避免高分辨率结果沿用上传体积限制。图片字节保存在私有存储，以服务端解析的 UID 分目录；数据库保存元数据和关联，不塞入 JSON 或队列消息。

## 参考图角色与套图逐条参考图

任务输入可选 `referenceRoles`（与 `referenceAssetIds` 一一对应，取值 `product`／`source`／`style`），只在用户标了原图或风格时出现；套图计划的方案可选 `referenceAssetIds`，必须是任务参考图的子集。Worker 通过 `itemReferenceAssetIds` 只发送这一条的图片，`textileItemInput` 在提示词前加按发送顺序的角色说明；字段缺省时发送全部参考图、提示词不变，旧任务与重试完全沿用原行为。

这两个字段是向后兼容的可选字段，但图片 Worker 用严格 schema 解析已存任务：发布时先部署图片 Worker，再部署主站，避免旧消费者读到新字段而让任务失败。

## 任务与计费边界

- generation_jobs 保存输入和逐图价格快照；generation_job_items 保存执行实例、租约和图片关联。
- 同一组织/用户/Idempotency-Key 保持同一任务；换参数重放返回 409，数据库余额不足返回 409，均不产生付费请求。
- 任务、全部图片项、每图 outbox 和积分预留位于同一 PostgreSQL 事务。HTTP 事务不发消息或调用服务商；提交后只触发 outbox 投递。
- 独立 Event 消费者认领 PostgreSQL outbox，通过数据库领取与执行令牌防止重复付费调用；定时器负责兜底恢复。
- outbox 最早 30 秒后可重新租赁，API 提交后即时投递、定时器每 3 小时补偿，可恢复消息丢失或投递确认中断。running 不回到 queued，重复消息不重复调用模型。
- API 提交或重试先原子写入任务、扣费和持久 outbox，再通过 Cloudflare Queue 唤醒独立消费者。每分钟 Cron 补投未确认意图并恢复租约；无回调任务由延迟消息查询原任务，不重投有歧义的付费提交。
- 每图独立执行与保存：成功保留扣除积分，明确拒绝退回该图积分；部分失败不删除成功兄弟图片。积分退款有唯一约束，不重复返还。
- 超时、断连、5xx、无法验证的响应、图片结果保存异常或执行租约到期，进入 needs_reconciliation，额度继续预留；不能靠队列重试重复付费。
- 服务商没有文档化幂等/查询协议。虽然发送稳定 Idempotency-Key 请求头，但不将其视为上游保证，不自动重试付费调用。
- 管理员必须先核对服务商记录，再提交 `{"verifiedFailed":true,"evidence":"服务商记录核对依据..."}` 确认失败。该接口记录核对人和依据，释放额度一次，不自动重新生成。实际已成功但本地无法入库的结果需要运维恢复文件/数据库，不可确认成未成功。
- 请求成功但进程在文件落盘与数据库提交之间退出可能留下孤立文件；任务会保留待核对，需运维核对后恢复或清理。当前没有自动成功结果恢复、计费回调或支付网关。
- 没有提供自动重发、公共注册、组织管理、成员邀请、在线充值、自动清理。不要将服务端接入等同于生产上线。

## 工作台接入

- `/commerce/create` 调用真实提交接口；支持纯文生图，参考图先上传并校验，再以资产 ID 提交。新草稿默认 1.5K。
- 历史、右侧索引与素材库不轮询列表；生产状态由 WebSocket 事件触发任务详情读取并定向更新缓存，支持游标加载更多。列表使用提前生成的 512px 缩略图，下载读取原图。
- 提交响应不确定时，浏览器会按用户和组织在 sessionStorage 保留同一请求快照与幂等编号，刷新后通过“确认上次提交”复用请求；不会自动重新生成。已运行但结果不确定的任务不自动重发；用户可以明确确认后在原记录重试，先结束旧尝试并退回原扣款，再提交新尝试，操作与未知结果依据可审计。管理员核对入口仍保留。
- `GET /api/v1/image-assets?limit=30&before=UUID` 返回组织内素材和短期签名链接。API 批量解析对象位置，主站 Worker 验证签名、过期时间与来源后读取私有 R2。原图、预览和缩略图分别存储，派生变体缺失时交给图片 Queue 补齐；浏览器按签名有效期缓存。配置见 [Cloudflare 部署](cloudflare-deployment.md)。

## 企业账号身份

企业密码登录与 JWT 已接入，配置、Cookie／Bearer、安全边界与创建账号见 [企业鉴权](enterprise-auth.md)。启用后浏览器不再自动使用本地工作台身份；既有服务端 API key 保持兼容。

## 图片质量参数

`POST /api/v1/image-tasks` 支持可选 `quality: "low" | "medium" | "high"`，对应界面「低／标准／高」。新提交从草稿发送该字段，非法值返回 400 及统一错误信封；参数由服务端契约校验。

任务 input JSON 快照保存质量，Worker 文生图 JSON 和图生图 multipart 均传递同名参数；编辑历史任务恢复对应选择，重新生成沿用原任务快照。不同质量属于不同输入，不能复用同一个幂等键覆盖已有任务。

兼容旧客户端及旧任务：缺省 quality 在解析后仍保持字段缺省，以保留旧任务的输入哈希；供应商调用时缺省按 medium，界面恢复为「标准」。无需数据库迁移，现有任务 input JSON 已支持保存此字段。

验证使用本地供应商请求 fixture，未调用付费服务；各模型是否实际执行对应质量及成本差异，仍需服务商确认或另行授权实测。当前积分预留仍按现有每张配置，不能据此声称质量间成本相同。

## 用户可见的任务与图片编号

用户对外 UID 为随机 10 位纯数字字符串（允许首位为 0）。任务编号为 `W` + 8 位 `0–9A–Z`，例如 `W07AZ9T2Q`；生成图及素材编号为 `P` + 8 位 `0–9A–Z`，例如 `P82ZX19M4`。用户 UID 不编码进任务或图片编号，避免暴露关联和注册数量。API 任务 `public_id`、结果项 `output_public_id`、素材 `public_id` 返回这些字符串；原 UUID 主键、外键、路由及 Worker 进程 ID 保留。

迁移 0005 在 0004 基础上新增随机编号列和 `public_identifiers` 登记表。数据库函数使用 `gen_random_uuid()` 的随机字节、跳过固定版本位，并用拒绝采样避免字符分布偏差；通过登记表主键原子预留号码，碰撞最多重新分配 32 次。业务表另有唯一约束与登记表外键。分配失败会中止当前事务，不会重试付费生图请求。记录删除后仍保留已提交编号的登记，避免重新使用。

迁移为历史记录重新分配新格式编号；旧数字任务号及 L 图片号登记为退役号码，旧 display_number 列保留以兼容旧部署。客户端兼容读取旧格式及缺省字段，新增数据使用新格式。必须先部署迁移，再部署 API／Worker；内部路由及授权始终通过 UUID 与服务端成员关系执行，公开编号不是权限凭证。

10 位数字空间为 100 亿个值，8 位 36 进制空间每类为 36^8 个值；容量有限，数据库唯一约束确保成功提交的数据不重复。备份恢复必须保留登记表，多库合并需要协调，不能承诺任意独立数据库或丢失历史登记后也永不重复。不要把 UID 解析为数字，否则会丢失前导 0。

## 失败任务的主动重新生成

失败／待核对任务由用户确认后调用原任务 `POST /image-tasks/:jobId/retry`，可选 `itemId` 只重试指定图片；服务端读取原快照、隔离旧执行并按事务维护扣费与退款，详见下文重试接口说明。不会自动重发有歧义的付费请求。已成功任务的重新生成使用新任务；旧版家纺配置升级也会创建新任务并保留原记录，不能把这些情况混同于失败重试。

## 历史记录刷新策略

工作台历史与右侧索引共享 TanStack Query 缓存。生产使用 Durable Objects 可休眠 WebSocket 接收任务、钱包、消息和版本事件，事件合并后定向读取最新资源；空闲时不轮询任务 API。首次连接、游标失效、重连或明确用户操作可按需校准缓存，详见 [实时推送](realtime.md)「连接、休眠与补齐」「避免重复读取」。

浏览器后台冻结可能延迟界面绘制，恢复前台后按游标补齐。供应商未提供或丢失 Webhook 时，由图片消费者延迟查询原供应商任务，规则见 [图片回调](image-webhooks.md)，与浏览器任务 API 定时轮询无关。结果未知时保留待核对状态，不把超时直接视为已退款。

## 隔离 Node 环境的任务 SSE

`GET /api/v1/image-events` 使用现有 Cookie／Bearer 身份；事件范围与任务、素材读取一致，由服务端解析组织成员关系。`image-models` 增加可选 `eventsEnabled`，用于兼容旧部署。SSE 响应为 `text/event-stream`，不包装 JSON 信封；鉴权、参数和服务不可用错误仍使用统一信封。支持 Last-Event-ID 请求头或非敏感 cursor 查询参数，游标为十进制 bigint 字符串。

生产通知链路为事务内 realtime_outbox → DO RPC → 可休眠 WebSocket，详见 [实时推送](realtime.md)。generation_events 继续保存任务与素材事件；原生 LISTEN/SSE 仅供隔离 Node 运行与测试，不再保留组织日志轮询适配。事件和业务写入同事务提交，回滚不会产生通知，事件内容不保存提示词、图片、凭证或供应商响应。

每个 API 进程共用一个专用 LISTEN 连接和固定大小查询池，不为每个浏览器占一条数据库连接。原生通知仅作唤醒，实际内容从持久化日志读取；监听自动恢复后唤醒已有连接补读。支持 ready、image.updated、resync、heartbeat、auth-expired 事件。正常事件带 id；ready／resync 要求客户端重新校准现有列表，超过 200 条补读时转为快照校准。Worker 每小时最多清理 1000 条超过 7 天的事件；旧游标重连仍校准快照。

连接每 15 秒心跳，空闲时每分钟验证会话，每次实际补发事件前再次鉴权。会话失效发送 auth-expired 并关闭；连接最长 10 分钟，客户端带游标重连。每个用户每 API 实例最多 8 条连接，断开／流错误／关闭进程时释放监听和定时器。事件流断开不取消、不重发 Worker 中的生图请求。

当前生产前端不使用这个 Node SSE 入口。浏览器连接、重连、缓存校准及去重的现行规则只在 [实时推送](realtime.md) 维护；提示词优化仍使用独立 POST SSE。

Node 接口验证：`ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:events` 在专用临时数据库执行迁移，验证隔离、提交／回滚、独立监听连接、任务生命周期、游标回放及撤销后停止发送，不调用付费模型。

## 生图耗时诊断

Worker 以 `Image generation stage timing` 输出结构化分段计时，包含 itemId、stage、durationMs，必要时包含响应字节数与 HTTP 状态码。禁止输出提示词、参考图、响应正文、凭据或签名 URL。

图片消费者记录参考图准备、供应商提交、回执入库、原任务查询、结果读取、图片存储和完成事务的阶段耗时。原图及变体编码、写入是存储总耗时的子项，不与总项相加；日志仅包含任务 ID、阶段和耗时。

旧同步渠道的阶段如下。

- claim / reference_read：领取任务与参考图片读取。
- provider_request_started / provider_headers：开始请求与收到响应头；此段包含连接、上传、网关等待和模型执行，不能直接等同于模型推理时间。
- provider_body / provider_decode：响应体接收与 base64 解码。
- image_storage / database_finish：图片解码编码落盘与完成事务。
- provider_complete / item_complete：供应商调用总耗时与本次处理总耗时，和子阶段重叠，不相加。
- provider_error / provider_timeout：供应商请求异常或达到总超时上限前的累计耗时。日志接收器异常不能影响付费结果或触发重试。

## 单图重试

`POST /image-tasks/:jobId/retry` 支持可选JSON字段 `itemId`，仍要求Idempotency-Key与身份验证。省略字段兼容旧客户端整批重试（旧客户端发送的完整input仍忽略，执行始终读取服务端存储输入）；传入时仅允许当前任务未被替代的failed／needs_reconciliation项，其他图片可以继续排队或执行。已成功图片不可通过此入口重试，异步旧尝试完成不会覆盖新尝试。

事务内按既有任务／子项锁顺序校验归属，必要时退休未决尝试并记录操作者，按原单价退款／重新扣款一次，只新增当前position的子项与outbox。generation_retries.target_item_id将幂等键绑定具体目标，重复请求回放，同键换图或切换批量被拒绝；旧行NULL不改变批量语义。丢失响应时浏览器保留retryJobId／retryItemId与原幂等键，刷新后确认原请求。迁移0018须先于API启用此功能，线上发布仍需单独授权。

钱包更新以账本事件为准，不从任务状态推测扣费或退款。客户端的请求合并、连接恢复与操作回执校准统一遵循 [实时推送](realtime.md)「避免重复读取」。

## 历史记录删除

`DELETE /api/v1/image-tasks/:id` 复用企业会话、可信来源保护与组织隔离，成功返回 `{id}`（统一 envelope），重复删除幂等；其他组织或未知 ID 返回404。迁移0025为 `generation_jobs` 添加可空 `archived_at`；历史查询排除归档记录，并通过持久任务事件通知其他会话。删除仅归档历史展示，不删除素材、任务详情、outbox或账本，不取消执行、不重试、不退款。部署时先迁移再更新 API。前端右侧卡片使用共享确认弹框与错误Toast。

## 素材库筛选与收藏

2026-11-03 起，素材库页面与各工具右侧的“我的素材”使用上表的筛选和收藏接口。收藏存于 `image_asset_favorites`（组织、成员、素材联合主键，组合外键约束素材归属与成员关系，按成员与收藏时间建索引），按成员区分；数量上限在同一成员的事务级 advisory lock 内校验，并发收藏不会超出。工具由任务输入判定：含 `textileSet` 为家纺裂变，含 `variation` 为套图计划，其余为主图制作，与历史筛选一致。

迁移统一使用 `packages/db/migrations/0038_asset_favorites.sql` 及其后续追加迁移。先升级目标 PostgreSQL，再部署 API；主站和独立图片 Worker 共用同一条 Drizzle 迁移链，不在运行时修改结构。

参考图单张原文件最多 50 MiB。浏览器把超过 5 MiB 的文件压缩为不超过 5 MiB 的上传副本，以减少网络传输，原文件保留在本地。副本最长边最多 3840 像素并保留透明通道。服务端再次校验并生成规范化 PNG，超过 4 MiB 时继续按比例缩小；该规则不应用于付费生成结果。不透明参考图发送中转站前可转 JPEG，透明图保持 PNG。


## 文本规划与参考图并行

POST /variation-plans 的可选 referenceCount 为 0–5，仅表达参考图数量；前端新计划发送 referenceAssetIds=[] 与实际 referenceCount，同时独立上传。模型只收到参考图编号。计划响应保留 referenceCount，旧客户端忽略新增字段；已有带素材 ID 的计划继续按原规则处理。

确认生成时，image-tasks 必须携带已持久化素材 ID，事务内校验归属、有效期和数量后才扣费。数量型计划匹配上传后的素材数量，已绑定 ID 的旧计划仍要求 ID 和顺序一致。上传缓存按组织、用户、原图片 ID 隔离；上传错误不重复调用规划模型。该变更使用既有 JSON input，不新增迁移；部署需先更新服务端再发布新前端。
