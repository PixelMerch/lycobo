# 模型服务后台与执行适配

2026-10-27。独立后台页面在本地运行；v0.3.0 发布准备已将模型结构迁移到生产 Supabase，并为主站配置新中转站，管理页面不因此视为已上线。

## 身份与服务边界

独立后台位于相邻 lycobo-admin 仓库，页面 http://localhost:8082/#model-services，登录 http://localhost:8082/login。后台 API 自己认证、执行 Casbin 菜单／按钮授权、管理配置和密钥，不调用主站企业账号登录。主站 /api/v1/model-management 已移除，图片 API／生成 Worker 仅消费模型能力、路由和已接收任务快照。

后台管理员存放 admin_users，会话在 admin_sessions，角色在 admin_roles，绑定在 admin_user_roles，登录限流在 admin_login_limits；均无业务 users 外键。新增迁移 0022、0023 已在本地执行。本地 admin 账号由显式初始化脚本创建，密码不写入迁移或源码。

当前是进程、身份和权限域分离，仍共享本地 PostgreSQL 实例及模型配置表，不代表物理数据库拆分。旧 platform_administrators 表保留兼容数据，不再用于后台授权。model_audit_events 新增 administrator_id 指向独立管理员；actor_id 可为空，仅保留旧审计证据。

## 配置步骤

1. 中转站：名称、HTTPS 源地址（如 https://api.ai-media.vip，不含 /v1）、协议、API Key、启用状态。默认禁用；Key 保存后只显示已配置，编辑留空保留旧值。
2. 模型渠道：选择中转站、前台模型、任意合法上游模型 ID、接口协议、执行方式、参考编辑与上限、提交超时、总等待上限和额外下载源。接口协议默认继承中转站，也可按渠道覆盖。
3. 默认路由：按图片创作／家纺主图裂变／局部修改及前台模型绑定一个渠道。默认渠道禁用或参考图能力不匹配时拒绝新任务，不自动跨站提交。

前台展示后台启用的全部图片模型，只读取公开能力。API 和 Worker 统一使用后台默认渠道；没有路由、渠道禁用或参考图能力不匹配时，在扣费前拒绝新提交，不回退环境变量。URL、供应商 Key、上游模型、编辑能力与超时均以渠道为准；分辨率统一支持 1K／2K／4K，由前端选择并在任务参数中保存。

支持 OpenAI 兼容同步图片（文生图 JSON、编辑 multipart）及 FluxPort 图片协议（JSON 参考图、同步或异步）。执行方式可选同步、异步优先、供应商默认；异步优先也接受同步图片响应。新站同协议可只填配置，不同协议仍需服务端适配，不能填写可执行脚本。

连接检查只请求 /v1/models，不发起付费生图，不证明模型、额度和参考图能力通过验收；缺少模型列表接口不等于不能生成。

## 加密与数据

MODEL_CREDENTIAL_SECRET 必须为 32 字节随机数的 Base64，独立后台 API 和生成 Worker 使用相同值；本地已分别保存在两个仓库忽略的 .env 中，不能放入 VITE_* 或 Git。密钥独立备份，直接更换会使旧记录无法解密；本轮未实现主密钥轮换。生产上线前需单独授权迁移并配置 Secrets。

供应商 Key 使用 AES-GCM 加密且版本不可覆盖；换 Key 新建版本，在途任务使用原版本。model_providers 保存中转站，model_credentials 保存密钥版本，model_channels 保存渠道能力，model_routes 保存默认映射，provider_executions 保存异步 ID／查询路径／租约／截止时间／失败次数，model_audit_events 保存操作者与动作。任务 generation_jobs.provider_snapshot 固定配置，不在公共任务返回值中暴露。既有表名未更改；管理和执行新表启用 RLS，不向匿名用户开放。

## 异步、存储和计费

任务、积分和 outbox 原子提交，每个视角一个子任务。付费 POST 只执行一次；202 后保存 task ID、同源查询路径和下次查询时间，结束消费。后续通过 outbox 维护和 Cron 调度 GET，不在 Worker 长时间等待。poll_after_ms、Retry-After 与指数退避决定最早查询时间，实际受维护间隔和 Cron 粒度影响。

`retryable: false` 表示不能重新提交生成，不阻止查询已受理的任务。`success` 摘要即使带有 `auto_poll: false`，缺少图片时仍通过同源 `result_url` 获取最终结果；未决／暂停／取消状态继续停止自动查询。

成功后拉取真实图片到私有 R2，再完成任务。摘要 result_url 作为任务 JSON 结果接口继续查询，不当成图片下载。下载仅允许源站与明确配置的 HTTPS 源；不把 Key 发往第三方 CDN，拒绝重定向。

明确失败逐项退款；结果不确定、查询停止或总等待超时转待核对，不自动重复付费提交。连续查询网络／限流／服务错误最多五次后停止。显式用户重试沿用原账务与审计语义。刷新后台、改配置、队列重复投递不重复扣款。

未实现 webhook、自动跨站重试、自动价格同步或任意新增前台模型。本轮未新增付费生成请求；已通过上游任务列表的 `client_request_id` 精确对应本地子项，恢复三张上游已成功、但本地误判待核对的历史结果。恢复只查询／下载已有任务，不修改原扣费，也不重发生成。

## 验证和后台规范

主站 pnpm check 与本地 opt-in pnpm test:integration；独立后台 pnpm check，独立临时库身份／Casbin／审计集成测试，浏览器登录、角色勾选、管理员分配及低权限隐藏验收。fixture 不调用付费模型。临时界面验收账号与角色清理后只保留初始化的 admin。

后台全部页面必须登录，操作反馈使用顶部 HeroUI Toast，访问受限用弹框，登录页仅保留必要表单。管理员与角色为真实持久化，首页、任务和账务仍为演示。细节见相邻 lycobo-admin/docs/admin-access.md。

## 协议适配与本地环境导入

provider-adapters.ts 定义实际请求协议注册表；configured-provider.ts 负责公共响应、任务查询和结果下载，provider-errors.ts 统一已知失败与未知结果语义。已支持 OpenAI 同步 Images、FluxPort 同异步 Images 和 Gemini 原生 generateContent；新中转站同协议只改后台，异步路径／鉴权／响应不同则新增适配器，不在前端或计费层添加分支。

运行时不再读取 VAKV_* 或 GENERATION_TIMEOUT_MS。生图默认启用，无 IMAGE_GENERATION_ENABLED 全局开关；`.env` 保留 MODEL_CREDENTIAL_SECRET 加密主密钥及基础设施配置，供应商凭据在独立后台配置。同步兼容适配器仅留给隔离验证工具，不是产品运行时回退。当前裂变以v5和逻辑gpt-image-2.5绑定后台渠道，见 textile-generation.md。同步结果、异步task ID及上游请求ID用于排查；不记录提示词、响应正文、Key或签名URL。

## v0.3.0 生产渠道

生产统一使用 `https://api.ai-media.vip`，不再为新请求使用旧中转站。FluxPort 渠道为 gpt-image-2／gpt-image-2.5 绑定图片创作及局部修改，家纺裂变使用 gpt-image-2.5；异步优先，当前仅启用1K。当前Key未提供 nano-banana-2.1，因此该渠道禁用，不回退旧站。生产Key加密入库，独立主密钥保存在 CloudBase 消费者云函数环境变量，GitHub不存储。此次只检查配置、加密和公开能力，没有额外付费生成。

## 简单后台配置扩展（2026-10-28）

独立后台管理中转站与图片、音乐、视频目录；每站一个 Key，渠道选择目录模型、站点和该站实际模型名，不引入密钥池或自动跨站调度。0026_admin_model_configuration 为追加迁移，回填既有图片模型/默认密钥并保留旧密文；model_channels.key_id 可为空以兼容旧写入。

图片消费者优先读取所选 Key 的当前凭据版本，在任务接收时固定快照，目录模型及所选 Key 停用后拒绝新任务。既有图片能力参数、账务和异步流程不改变。音乐/视频仅管理配置，不代表执行协议、播放或计费已接通；主站逻辑图片模型枚举不因后台新目录自动扩展。

共享本地库已通过 db:migrate 升级；独立后台 init.sql 含同等基线，详细操作见相邻 lycobo-admin/docs/model-services.md。此次没有线上迁移、付费调用或部署；未来发布须先完成数据库迁移，再更新读取新表/列的服务。

模型目录新增 nullable logo_url，仅保存公开 Logo 对象地址；上传和展示由独立 admin 负责，共享追加迁移 0027。Logo 的公开桶与主站生成图片私有桶隔离，见 [私有 S3 存储](s3-storage.md)。

0028 曾引入目录 upstream_model，目前仅保留旧版本兼容；实际调用名称按中转站保存在渠道 settings.upstreamModel，目录不再提供统一调用模型输入。主站按默认渠道解析，任务快照不变。


## 中转站与展示目录（2026-10-28）

后台简化为中转站、模型目录、模型渠道、默认渠道四页。每站维护官网 website_url、API 源地址、一个加密 API Key。目录的名称、Logo 和分类供主站展示，同一目录可绑定多个中转站；实际调用名称按站保存在 model_channels.settings.upstreamModel，不能使用目录全局名称替代。原目录 upstream_model、provider_id 仅兼容旧版本，渠道映射为准。主站继续按默认路由解析渠道、站点及不可变凭据快照；不自动发布新目录条目。追加迁移 0029 增加官网与兼容关联列，不改历史任务。音乐、视频仍仅配置管理。后台目录绑定需要 catalog.save 和 channel.save，默认引用保护解绑；每站密钥替换保留旧版本。


## 主站模型展示信息

主站创作导航从公开 GET /api/v1/image-model-logos 读取后台配置的展示名称、Logo、模型介绍和能力说明。响应仅包含现有三个公开图片模型的稳定 id、name、logoUrl、description 和 capabilitySummary，不暴露站点、调用模型或凭据，不自动新增可用模型。按 model_catalog.code 关联，禁止按显示名称或中转站调用名称猜测匹配；Banana 2.1 显式兼容旧目录标识 gemini-nano-banana-2.1 和 gemini-3.1-flash-image-preview，优先使用规范标识配置的 Logo；后台修改 Logo 后，主站刷新或查询过期后重新聚焦页面会更新。缺少 Logo、请求失败或图片失效时显示中性图片图标，不再使用示例照片。菜单尺寸、权限和实际生成行为保持原样；展示名称和两行介绍由后台配置，留空介绍不显示。0030_model_catalog_presentation 追加 description、capability_summary 并迁入原有文案，每项最多 160 字。

主站模型列表遵循后台目录 sort_order，排序迁移为 0031_model_catalog_sort_order。后台支持全部分类和过滤后的拖动排序；主站仅对当前支持的公开模型应用顺序，不因此发布其他模型或修改路由。

无渠道快照的旧失败任务，仅在用户显式重试且没有其他在途子项时，原子读取当前后台渠道并建立快照，再执行退款／扣费与 outbox 写入；缺少渠道时整个事务回滚、不新增扣费。已有快照继续固定原配置，不覆盖在途执行；全部子项均明确失败时，后续用户主动重试可采用当前渠道，旧快照保存到原子项审计证据。API／Worker 不读取旧环境变量；本地已移除这些旧字段，线上 Secrets 本次不操作。

渠道旧 JSON 中的 `resolutions` 只为兼容历史数据保留，不再限制可用分辨率，也不需要管理员维护；新任务统一接受已校验的 1K／2K／4K，Images API 执行端按任务值计算尺寸，4K 最长边仍为3840；Gemini 原生接口直接传 imageSize 档位。供应商是否成功响应仍以实际任务结果为准。

## Gemini 原生图片协议（2026-10-28）

按 [FluxPort Gemini 文档](https://uselg.top/docs?model=gemini-3.1-flash-image-preview) 对接 `gemini-native`：POST `/v1beta/models/{upstreamModel}:generateContent`，Bearer 鉴权，提示词和参考图放入 `contents[].parts`（不透明参考图发送前压缩为 JPEG，透明图保持 PNG，`mimeType` 按实际内容声明，见[运行计费优化](cloudbase-deployment.md#运行计费优化)）；比例、1K／2K／4K 使用 `generationConfig.imageConfig.aspectRatio/imageSize`。不发送 Images API 的 n、quality、async 或像素 size。Gemini 的 4K 使用供应商档位，不套用 Images API 最长边 3840 的尺寸计算。

同步解析 candidates 中的 inlineData 或 fileData；纯文字、空图片结果不视为成功。异步 202 的 task_id/status_url/result_url 继续使用持久化查询流程，查询返回的原生结果同样解析，不重新付费 POST。结果文件仍需通过现有来源白名单、大小限制与真实图片校验，入私有存储后才能完成任务。

渠道 `settings.adapter` 可覆盖中转站默认协议，null／省略则继承；同一个站可同时提供 GPT Images 与 Gemini 原生接口，不需要复制 Key。任务快照固定最终协议，修改渠道不改变旧任务。全部子项明确失败的旧任务，用户主动重试时重新读取当前渠道，并保留旧尝试配置证据；部分成功、在途或结果不确定的任务不更换快照。

本地 Banana 2.1 已配置调用 `gemini-3.1-flash-image-preview`，Banana Pro 配置调用 `gemini-3-pro-image-preview`，两者均使用 Gemini 原生协议；GPT 渠道保留 Images 协议。本轮通过模拟上游的同步／异步请求、不可变快照、重复消费与扣费集成测试，以及后台保存／读取验证；没有付费调用、线上配置变更或部署，实际模型与 Key 分组可用性尚需真实生成验证。

## 上游额外图片与查询中断恢复（2026-10-28）

裂变继续按每个视角单独请求 `n=1`。若供应商仍返回多张，只按返回顺序交付第一张到当前付费槽位，不新增子任务、不多扣用户积分；其余图片不自动下载或持久化。空结果、非法图片和不可信下载源仍拒绝，不能把未存储结果标为成功。供应商是否按多张收费需以其真实请求记录核对，本地不假定供应商始终遵守 n。

已取得上游任务 ID 的查询，领取执行租约时保留下次查询时间；在总等待期限内，执行进程中断且租约到期后可继续 GET 同一任务。有效租约期间不重复投递，接收新租约后忽略旧执行者的完成；没有上游任务 ID 的付费提交仍转待核对，不自动重发 POST。成功恢复时清理历史错误码，沿用原扣费。

本地任务 WUUURKIBT：原 10 个视角中 8 个成功，正面旧尝试上游返回 3 张触发旧单张校验，平拍查询在本地重载后中断。本轮只恢复仍有效且有明确上游 ID 的平拍结果，没有新增付费提交；当前为 9 个成功、1 个待核对。正面旧尝试已被用户重试替换，替换尝试没有持久化可查询上游 ID，不能自动用被替换尝试的结果覆盖。保留旧请求记录与重试账务以供人工核对。

隔离集成先复现“中断查询误转待核对”与“三张响应丢弃可用图片”的失败断言，再验证修复、一次 POST、一次扣款、租约排他和旧执行者拒绝；测试不调用付费模型。

## 明确失败任务的渠道修正重试（2026-10-28）

W2MTDUFDF 连续 HTTP 400 的原因是旧任务固定了 fluxport-images，后台改为 gemini-native 后重试仍复用旧快照。现在仅当所有当前子项均明确 failed、且是用户主动重试时，事务内重新解析当前启用渠道；旧快照留在原子项 reconciliation_evidence，退款／扣费／替换／outbox 仍原子执行。重试幂等键先于配置更新检查，渠道不可用或余额不足整体回滚。在途、部分成功或 needs_reconciliation 不借此覆盖快照。

用户明确授权真实付费验证后，对本地 W2MTDUFDF 只重试 1 张 Banana Pro（gemini-3-pro-image-preview），原生 Gemini 异步任务完成并入私有存储；主站任务 API succeeded、缩略图 HTTP 200 WebP，人工查看确认粉色改红色且白色保留。该新尝试账本只有一笔 -20 积分，没有自动追加付费重试；未操作线上环境。

隔离回归先复现旧快照仍为 fluxport-images，再验证主动重试切换协议、旧配置留证、重复重试不重复扣费及新协议生成完成；pnpm check 和本地隔离集成通过。不以此单次验证宣称所有模型、分辨率或 Key 分组都已验收。

## Grok 图片接入（2026-10-28）

依据 [grok-imagine-image-2.0 分组 115 文档](https://uselg.top/docs?model=grok-imagine-image-2.0&group_id=115&offer_id=media_6d7e42e826e7510842fd430993768372)，Grok 复用 OpenAI 兼容 Images API，文生图 POST /v1/images/generations，参考图通过 /v1/images/edits 的 images[].image_url Data URI 发送；Bearer 鉴权、n=1、HTTP 200/202 和现有持久化查询／下载／计费流程不变。不增加 Grok 协议下拉选项。

该线路未声明质量枚举，因此按最终上游模型 ID（而非展示名或目录 code）识别 grok-imagine-image-2.0，省略 quality，避免继承 GPT 默认 medium。仍按任务分辨率计算像素 size，4K 最长边 3840；接口的 1K／2K／4K 选项和请求构造测试不证明供应商接受全部尺寸。此文档没有完整发布具体尺寸和参考图上限；最新最小请求实测中参考图编辑仍失败，因此本地现设为文生图专用（editsEnabled=false、maxReferences=0），不能据文档字段宣称真实编辑已验证。

本地已有 Grok 2 目录和渠道，调用名为 grok-imagine-image-2.0；已启用目录，渠道沿用中转站协议、异步优先，仅保留 create 默认路由，移除 local-edit 路由。没有将 Grok 用于家纺默认模型。目录稳定 code 与调用名分离，前端继续读取公开配置。

最初 /v1/models 未包含 Grok；用户明确授权后，已在中转站为现有 lyco 密钥追加分组 115，保留原 7 个分组与顺序，Grok 排第 8。只读复查 HTTP 200 且公开模型列表已包含 grok-imagine-image-2.0。此授权变更发生在共享密钥上，会影响所有使用该密钥的环境；本轮没有部署或修改线上数据库。

已验证请求不带 quality、正确生成／编辑端点和参考图格式、同步／异步图片处理，以及真实隔离数据库下的原子扣费、单次提交和重复消费幂等。付费对照结果见下表；不能据文生图成功宣称参考编辑和各分辨率全部验收。

## Seedream 5.0 Pro（2026-10-28）

按 [分组 113 接入文档](https://uselg.top/docs?model=seedream-5.0-pro&group_id=113&offer_id=media_b530612dbd62b5b6cb48eb56d4845e65)，seedream-5.0-pro 使用 OpenAI 兼容 Images API，与 GPT／Grok 共用 JSON 提交和 HTTP 200／202、任务查询、结果下载流程；Banana 系列仍走 Gemini 原生接口，不新增 Seedream 协议。文生图为 generations，编辑为 edits，参考图使用 images[].image_url Data URI，每个付费子项 n=1。

Seedream 文档未声明质量枚举，与 Grok 一样不发送 GPT 默认 quality。请求参数测试和隔离 DB／存储／扣费集成参数化覆盖两个模型。尺寸仍从任务值计算；本线路没有完整公开具体尺寸和参考图上限，本地暂限 1 张参考图，不以此宣称供应商上限或所有尺寸已验证。

本地启用已有 Seedream 5.0 Pro 目录，调用名 seedream-5.0-pro，渠道沿用中转站 OpenAI 兼容协议、异步优先，绑定 create／local-edit；未修改家纺默认模型。现有 Key 的 /v1/models 已包含该模型，本次没有修改 Seedream 密钥权限。现有密钥已绑定的 Seedream 分组仍按中转站优先级选路，未强制切换到文档中的 113 分组，也不把文档示例当作真实生成验收。

### Grok WPSG90DFK 的实际失败证据

该任务为 2K 参考图编辑，快照为 fluxport-images；请求构造使用 application/json 和 JSON 字符串，字段为 model/prompt/size/n/response_format/async/images。中转站接受异步并返回 imgtask_c4ac7e0e-880a-47a9-ad88-5bfbbe772d37，随后 generation 阶段失败，错误记录提示当前接口要求 JSON。本地并未使用 multipart；尚不能仅凭此错误确定中转站内部转发与上游接口之间的具体原因，禁止将其写为已修复。

依照用户此前付费调试授权，另对同一任务进行一次同步模式诊断（子项 72c4ed79-50b0-46dc-964a-75dbe5ce9450），收到 HTTP 502。随后只读任务列表按 client_request_id 找到 imgtask_c5ef04f1-f87a-4364-adfd-40847391097a，状态 failed、请求 1、成功 0、charged_amount 0；通过组织管理员 reconcile-failure 接口保存证据并退回本次 20 积分。没有再次付费重发，Grok 渠道已恢复原 async-preferred。此诊断没有证明 JSON 错误已修复或供应商 2K 规格可用。需中转站核对该 Grok 生成线路；本地不擅自改用 Gemini 协议或未经文档支持的端点来绕过。

### Grok JSON 最小请求对照（2026-10-28）

用户授权真实付费测试后，在本地账号和本地私有 S3 中逐次创建持久化任务，每次一张、一次付费 POST；轮询和下载未重新生成。通过实际 Request 序列化核对 Content-Type 为 application/json 且正文可解析为 JSON；不记录原始提示词、素材、认证头或供应商完整响应。

| 本地任务 | 端点与字段 | 结果与账务 |
| --- | --- | --- |
| WWQKPMA62 | generations：model、prompt、n | 成功，输出960×960，扣20积分 |
| W6LC7IVER | edits：model、prompt、n、images[].image_url；单张 Data URI，不带size／quality／response_format | 异步受理后失败，仍提示需要JSON；扣20后自动退20 |
| W9JS0JM54 | generations：正常应用请求model、prompt、size、n、response_format、async | 成功，输出960×960，扣20积分 |

编辑失败的上游任务为 imgtask_0b5d78a2-8ad9-4954-88e3-e9edc23d75d3，终态failed、成功0、charged_amount=0，错误码image_generation_failed。即使移除附加参数仍失败，尚不能判定中转站内部具体转发原因；不将编辑错误记为已修复。本次净扣40积分；两张成功结果均持久化到本地存储。请求1K并收到960×960，未验证精确像素控制、2K或4K能力。

本地Grok渠道现收敛为已验证的文生图，目录继续启用，不修改其他模型或线上配置。主站提交、历史重试、局部编辑和家纺生成均按tools中当前模型的能力及参考图上限判断，不再用全局editsEnabled替代单个渠道能力；tools存在但对应功能未配置时保持不可用，仅对没有tools的旧版响应保留兼容。Grok带参考图的草稿保留并提示移除参考图后生成，不静默丢弃用户素材或产生扣费。

回归验证：pnpm check通过（37个测试文件，187通过、1跳过）；定向浏览器测试覆盖当前模型不支持参考图但全局开启时禁用提交／重试、清除参考图恢复文生图、家纺10视角与6张参考图提交、局部编辑提交，3项通过。未运行完整本地E2E，未推送或部署线上。

### Grok 公网URL参考图对照（2026-10-29）

使用用户提供的公网PNG地址做一次独立供应商诊断；HEAD返回HTTP200、image/png、2,273,225字节。直接按中转站文档发送JSON：model、prompt、单项images[].image_url及async=true，不带size、quality、response_format或额外n。只提交一次，持久化幂等键和任务回执后查询原任务，没有自动重发，也没有更改主站渠道能力。

中转站HTTP202受理，任务imgtask_2bb2e2fa-5bc3-4651-b906-a4c76b665fd2，随后终态failed、image_generation_failed、阶段generation、成功0、charged_amount=0。结构化错误category=service_uncertain、reason_code=service_http_400、cause_confirmed=false；与此前Data URI的JSON／415提示不同，不能将这次失败解释为同一个已确认原因。公网URL未使编辑成功，仍需中转站核查生成服务HTTP400的具体原因。诊断直接使用供应商API，没有创建主站任务或扣主站钱包积分；不代表正常业务路径绕过持久任务和扣费。

用户进一步要求把同一份公网参考图JSON提交到/v1/images/generations，仅切换端点，其余字段不变。一次POST返回HTTP202，任务imgtask_5511e70c-6b27-48a8-8b7f-f81aed491b20；只读查询原任务后终态failed、image_generation_failed、generation阶段、service_http_400，requested=1、successful=0、charged_amount=0。当前实测不能通过切换generations端点解决参考图问题；未修改业务端点、渠道能力或线上配置。

## 智能裂变的语言分析

语言分析与图片渠道分开：`model_planners.tool='smart-variation'` 配置 HTTPS 源地址、`upstream_model='claude-sonnet-5'`、超时与启用状态，`provider_id` 引用现有中转站的默认加密密钥。读取时要求中转站同样启用，通过 `MODEL_CREDENTIAL_SECRET` 解密。密钥不写入计划、前端、日志或 Git。当前独立管理应用尚无此配置表的编辑页面；本地由显式 SQL 配置，部署前须迁移并配置目标环境，不能把本地配置视为线上已生效。

后台历史配置 `protocol=anthropic-messages`，使用 Claude 原生 `POST /v1/messages`，`x-api-key` 与版本头鉴权，文字需求及最多5张授权PNG缩略图以base64内容块输入，输出JSON计划。保留独立的 `openai-chat` 适配用于其他中转站，协议在服务端配置，不自动跨协议重发。现配置语言地址 `https://api.uselg.top`，与图片地址分开；前端只调用业务 `/variation-plans`，不直连供应商。图片里的文字不作为指令，结果严格验证为1–10条标题和独立提示词，不接受截断、空结果或重复提示词。

计划按企业及用户隔离，分析不扣图片积分，每用户每分钟最多3次新分析。相同幂等键只读已有状态，不重复请求模型；网络超时标记 `uncertain`，进程中断超过120秒的运行记录同样转待确认，不自动补发。分析成本由模型供应商账单记录，当前没有单独向用户收取分析积分。

`generation_jobs.input.variation` 保存用户确认后的方案快照；服务端校验计划所有权和参考图一致性，固定 Image 2.5，沿用图片任务的原子扣费及outbox。Worker按方案位置提取对应提示词，每次 `count=1`，不会把整组数量传给每个方案。重复创建、失败退款与不明确付费结果沿用现有任务机制。

### 主站独立计划服务

`STANDALONE_MODELS=true` 时，智能裂变固定直连 DeepSeek 官方 `https://api.deepseek.com/chat/completions`，模型 `deepseek-flash`，不读取后台语言渠道或使用语言中转站。`DEEPSEEK_API_KEY` 使用 DeepSeek 官方 Key，仅在 API 服务端配置；图片生成仍用独立的 `STANDALONE_IMAGE_API_KEY`。保留后台表和其他协议适配供后续管理功能使用。

按[官方视觉文档](https://api-docs.deepseek.com/guides/vision/)发送已授权缩略图 Base64 与 `detail=low`；无参考图仅发送文字，不虚构商品视觉分析。依据[思考模式文档](https://api-docs.deepseek.com/guides/thinking_mode/)显式 `thinking.type=disabled`，避免默认开启思考；使用 JSON 输出、`max_tokens=8192`、单轮请求和简短独立提示词来控制费用。最多20条，按用户指定的张数或颜色、场景、视角等目标列表确定数量；如“红色、蓝色、白色”为3条，“换成红色，白色部分不变”为1条，未指定数量或变化项时只生成1条；不为省成本减少用户要求的方案数。保留60秒超时、取消、幂等、严格结果校验，不自动重发。

DeepSeek独立适配真实验证（2026-10-31）：官方Key、低细节商品参考图和非思考JSON输出，3条计划HTTP200，663 token，总耗时约2.7秒；20条计划HTTP200，1955 token，总耗时约10.1秒。未自动重发、未创建或扣费生图任务。结果仅为这两次请求，不保证后续延迟。

计划数量语义验证（2026-10-31）：未写张数、仅列红/蓝/白三色，真实官方请求返回3条（约1.9秒）；仅要求换红并保留白色部分，返回1条（约1.4秒）。保留条件不计作新方案，不默认扩展至10条。

## 提示词优化

主图制作、首页、套图计划和视频创作复用魔法棒，点击后在按钮旁的浮层确认消耗 1 积分。服务端使用现有官方 DeepSeek Chat Completions 配置，关闭思考模式，按工具扩写用户原文。仅传提示词文本，保留已有的 `@图片N` 引用，不发送参考图。

- `POST /api/v1/prompt-optimizations` 使用企业身份和可信来源检查，请求含 UUID 幂等键及 `{prompt, tool}`。响应逐段发送 `delta`，`complete` 返回持久化的完整结果。客户端在流结束前仅展示预览，结束后才更新可编辑草稿。
- 领取时原子扣 1 积分并写入请求记录，同键重放返回原结果。失败或服务端在结算前收到取消时退回积分。异常中断后，超过两分钟的未结算请求在该用户再次发起优化时退回积分。连接中断时当前页面可用原键核对结果。
- 发布前先应用 CloudBase 迁移 `20261104150000_prompt_optimizations.sql`；本地 PostgreSQL 对应 `0042_prompt_optimizations.sql`。云端网关实际逐段透传和真实 DeepSeek 调用须在目标环境验收。
