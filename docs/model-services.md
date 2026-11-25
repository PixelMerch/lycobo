# 模型服务后台与执行适配

主站线上以独立模式运行，使用服务端固定模型路由（见下文“主站试用独立模式”）。本文其余部分描述独立后台和可配置渠道；后台页面只在本地运行，未切换到线上环境。

## 身份与服务边界

独立后台位于相邻 lycobo-admin 仓库，页面 http://localhost:8082/#model-services，登录 http://localhost:8082/login。后台 API 自己认证、执行 Casbin 菜单／按钮授权、管理配置和密钥，不调用主站企业账号登录。主站 /api/v1/model-management 已移除，图片 API／生成 Worker 仅消费模型能力、路由和已接收任务快照。

后台管理员存放 admin_users，会话在 admin_sessions，角色在 admin_roles，绑定在 admin_user_roles，登录限流在 admin_login_limits；均无业务 users 外键。新增迁移 0022、0023 已在本地执行。本地 admin 账号由显式初始化脚本创建，密码不写入迁移或源码。

当前是进程、身份和权限域分离，仍共享本地 PostgreSQL 实例及模型配置表，不代表物理数据库拆分。旧 platform_administrators 表保留兼容数据，不再用于后台授权。model_audit_events 新增 administrator_id 指向独立管理员；actor_id 可为空，仅保留旧审计证据。

## 配置步骤

1. 中转站：名称、HTTPS 源地址（如 https://api.ai-media.vip，不含 /v1）、协议、API Key、启用状态。默认禁用；Key 保存后只显示已配置，编辑留空保留旧值。
2. 模型渠道：选择中转站、前台模型、任意合法上游模型 ID、接口协议、执行方式、参考编辑与上限、提交超时、总等待上限和额外下载源。接口协议默认继承中转站，也可按渠道覆盖。
3. 默认路由：按主图制作／家纺裂变／局部修改及前台模型绑定一个渠道。默认渠道禁用或参考图能力不匹配时拒绝新任务，不自动跨站提交。

前台展示后台启用的全部图片模型，只读取公开能力。API 和 Worker 统一使用后台默认渠道；没有路由、渠道禁用或参考图能力不匹配时，在扣费前拒绝新提交，不回退环境变量。URL、供应商 Key、上游模型、编辑能力与超时均以渠道为准；分辨率统一支持 1K／2K／4K，由前端选择并在任务参数中保存。

支持 OpenAI 兼容同步图片（文生图 JSON、编辑 multipart）及 FluxPort 图片协议（JSON 参考图、同步或异步）。执行方式可选同步、异步优先、供应商默认；异步优先也接受同步图片响应。新站同协议可只填配置，不同协议仍需服务端适配，不能填写可执行脚本。

连接检查只请求 /v1/models，不发起付费生图，不证明模型、额度和参考图能力通过验收；缺少模型列表接口不等于不能生成。

## 加密与数据

MODEL_CREDENTIAL_SECRET 必须为 32 字节随机数的 Base64，独立后台 API 和生成 Worker 使用相同值；本地已分别保存在两个仓库忽略的 .env 中，不能放入 VITE_* 或 Git。密钥独立备份，直接更换会使旧记录无法解密；本轮未实现主密钥轮换。生产上线前需单独授权迁移并配置 Secrets。

供应商 Key 使用 AES-GCM 加密且版本不可覆盖；换 Key 新建版本，在途任务使用原版本。model_providers 保存中转站，model_credentials 保存密钥版本，model_channels 保存渠道能力，model_routes 保存默认映射，provider_executions 保存异步 ID／查询路径／租约／截止时间／失败次数，model_audit_events 保存操作者与动作。任务 generation_jobs.provider_snapshot 固定配置，不在公共任务返回值中暴露。既有表名未更改；管理和执行新表启用 RLS，不向匿名用户开放。

## 异步、存储和计费

任务、积分和 outbox 原子提交，每个视角一个子任务。付费 POST 只执行一次；202 后保存 task ID、同源查询路径和下次查询时间，结束消费。后续通过 outbox 维护和 Cron 调度 GET，不在 Worker 长时间等待。poll_after_ms、Retry-After 与指数退避决定最早查询时间，实际受维护间隔和 Cron 粒度影响。

`retryable: false` 表示不能重新提交生成，不阻止查询已受理的任务。`success` 摘要即使带有 `auto_poll: false`，缺少图片时仍通过同源 `result_url` 获取最终结果；未决／暂停／取消状态继续停止自动查询。

成功后拉取真实图片到私有存储，再完成任务。摘要 result_url 作为任务 JSON 结果接口继续查询，不当成图片下载。下载仅允许源站与明确配置的 HTTPS 源；不把 Key 发往第三方 CDN，拒绝重定向。

明确失败逐项退款；结果不确定、查询停止或总等待超时转待核对，不自动重复付费提交。连续查询网络／限流／服务错误最多五次后停止。显式用户重试沿用原账务与审计语义。刷新后台、改配置、队列重复投递不重复扣款。

未实现自动跨站重试、自动价格同步或任意新增前台模型。图片完成回调见[图片 Webhook](image-generation-api.md#图片-webhook-与延迟查询)。

## 验证和后台规范

主站 pnpm check 与本地 opt-in pnpm test:integration；独立后台 pnpm check，独立临时库身份／Casbin／审计集成测试，浏览器登录、角色勾选、管理员分配及低权限隐藏验收。fixture 不调用付费模型。临时界面验收账号与角色清理后只保留初始化的 admin。

后台全部页面必须登录，操作反馈使用顶部 HeroUI Toast，访问受限用弹框，登录页仅保留必要表单。管理员与角色为真实持久化，首页、任务和账务仍为演示。细节见相邻 lycobo-admin/docs/admin-access.md。

## 协议适配与本地环境导入

provider-adapters.ts 定义实际请求协议注册表；configured-provider.ts 负责公共响应、任务查询和结果下载，provider-errors.ts 统一已知失败与未知结果语义。已支持 OpenAI 同步 Images、FluxPort 同异步 Images 和 Gemini 原生 generateContent；新中转站同协议只改后台，异步路径／鉴权／响应不同则新增适配器，不在前端或计费层添加分支。

运行时不再读取 VAKV_* 或 GENERATION_TIMEOUT_MS。生图默认启用，无 IMAGE_GENERATION_ENABLED 全局开关；`.env` 保留 MODEL_CREDENTIAL_SECRET 加密主密钥及基础设施配置，供应商凭据在独立后台配置。同步兼容适配器仅留给隔离验证工具，不是产品运行时回退。当前裂变以v5和逻辑gpt-image-2.5绑定后台渠道，见 textile-generation.md。同步结果、异步task ID及上游请求ID用于排查；不记录提示词、响应正文、Key或签名URL。

## 简单后台配置扩展

独立后台管理中转站与图片、音乐、视频目录；每站一个 Key，渠道选择目录模型、站点和该站实际模型名，不引入密钥池或自动跨站调度。0026_admin_model_configuration 为追加迁移，回填既有图片模型/默认密钥并保留旧密文；model_channels.key_id 可为空以兼容旧写入。

图片消费者优先读取所选 Key 的当前凭据版本，在任务接收时固定快照，目录模型及所选 Key 停用后拒绝新任务。既有图片能力参数、账务和异步流程不改变。音乐/视频仅管理配置，不代表执行协议、播放或计费已接通；主站逻辑图片模型枚举不因后台新目录自动扩展。

共享本地库已通过 db:migrate 升级；独立后台 init.sql 含同等基线，详细操作见相邻 lycobo-admin/docs/model-services.md。发布须先完成数据库迁移，再更新读取新表/列的服务。

模型目录新增 nullable logo_url，仅保存公开 Logo 对象地址；上传和展示由独立 admin 负责，共享追加迁移 0027。Logo 的公开桶与主站生成图片私有桶隔离，见 [私有 S3 存储](development.md#本地-s3-存储)。

0028 曾引入目录 upstream_model，目前仅保留旧版本兼容；实际调用名称按中转站保存在渠道 settings.upstreamModel，目录不再提供统一调用模型输入。主站按默认渠道解析，任务快照不变。

## 中转站与展示目录

后台简化为中转站、模型目录、模型渠道、默认渠道四页。每站维护官网 website_url、API 源地址、一个加密 API Key。目录的名称、Logo 和分类供主站展示，同一目录可绑定多个中转站；实际调用名称按站保存在 model_channels.settings.upstreamModel，不能使用目录全局名称替代。原目录 upstream_model、provider_id 仅兼容旧版本，渠道映射为准。主站继续按默认路由解析渠道、站点及不可变凭据快照；不自动发布新目录条目。追加迁移 0029 增加官网与兼容关联列，不改历史任务。音乐、视频仍仅配置管理。后台目录绑定需要 catalog.save 和 channel.save，默认引用保护解绑；每站密钥替换保留旧版本。

## 主站模型展示信息

主站创作导航从公开 GET /api/v1/image-model-logos 读取后台配置的展示名称、Logo、模型介绍和能力说明。响应仅包含现有三个公开图片模型的稳定 id、name、logoUrl、description 和 capabilitySummary，不暴露站点、调用模型或凭据，不自动新增可用模型。按 model_catalog.code 关联，禁止按显示名称或中转站调用名称猜测匹配；Banana 2.1 显式兼容旧目录标识 gemini-nano-banana-2.1 和 gemini-3.1-flash-image-preview，优先使用规范标识配置的 Logo；后台修改 Logo 后，主站刷新或查询过期后重新聚焦页面会更新。缺少 Logo、请求失败或图片失效时显示中性图片图标，不再使用示例照片。菜单尺寸、权限和实际生成行为保持原样；展示名称和两行介绍由后台配置，留空介绍不显示。0030_model_catalog_presentation 追加 description、capability_summary 并迁入原有文案，每项最多 160 字。

主站模型列表遵循后台目录 sort_order，排序迁移为 0031_model_catalog_sort_order。后台支持全部分类和过滤后的拖动排序；主站仅对当前支持的公开模型应用顺序，不因此发布其他模型或修改路由。

无渠道快照的旧失败任务，仅在用户显式重试且没有其他在途子项时，原子读取当前后台渠道并建立快照，再执行退款／扣费与 outbox 写入；缺少渠道时整个事务回滚、不新增扣费。已有快照继续固定原配置，不覆盖在途执行；全部子项均明确失败时，后续用户主动重试可采用当前渠道，旧快照保存到原子项审计证据。API／Worker 不读取旧环境变量；本地已移除这些旧字段，线上 Secrets 本次不操作。

渠道旧 JSON 中的 `resolutions` 只为兼容历史数据保留，不再限制可用分辨率，也不需要管理员维护；新任务统一接受已校验的 1K／2K／4K，Images API 执行端按任务值计算尺寸，4K 最长边仍为3840；Gemini 原生接口直接传 imageSize 档位。供应商是否成功响应仍以实际任务结果为准。

## Gemini 原生图片协议

按 [FluxPort Gemini 文档](https://uselg.top/docs?model=gemini-3.1-flash-image-preview) 对接 `gemini-native`：POST `/v1beta/models/{upstreamModel}:generateContent`，Bearer 鉴权，提示词和参考图放入 `contents[].parts`（不透明参考图发送前压缩为 JPEG，透明图保持 PNG，`mimeType` 按实际内容声明，见[图片处理](releasing.md#图片处理)）；比例、1K／2K／4K 使用 `generationConfig.imageConfig.aspectRatio/imageSize`。不发送 Images API 的 n、quality、async 或像素 size。Gemini 的 4K 使用供应商档位，不套用 Images API 最长边 3840 的尺寸计算。

同步解析 candidates 中的 inlineData 或 fileData；纯文字、空图片结果不视为成功。异步 202 的 task_id/status_url/result_url 继续使用持久化查询流程，查询返回的原生结果同样解析，不重新付费 POST。结果文件仍需通过现有来源白名单、大小限制与真实图片校验，入私有存储后才能完成任务。

渠道 `settings.adapter` 可覆盖中转站默认协议，null／省略则继承；同一个站可同时提供 GPT Images 与 Gemini 原生接口，不需要复制 Key。任务快照固定最终协议，修改渠道不改变旧任务。全部子项明确失败的旧任务，用户主动重试时重新读取当前渠道，并保留旧尝试配置证据；部分成功、在途或结果不确定的任务不更换快照。

本地 Banana 2.1 已配置调用 `gemini-3.1-flash-image-preview`，Banana Pro 配置调用 `gemini-3-pro-image-preview`，两者均使用 Gemini 原生协议；GPT 渠道保留 Images 协议。

## 上游额外图片与查询中断恢复

裂变继续按每个视角单独请求 `n=1`。若供应商仍返回多张，只按返回顺序交付第一张到当前付费槽位，不新增子任务、不多扣用户积分；其余图片不自动下载或持久化。空结果、非法图片和不可信下载源仍拒绝，不能把未存储结果标为成功。供应商是否按多张收费需以其真实请求记录核对，本地不假定供应商始终遵守 n。

已取得上游任务 ID 的查询，领取执行租约时保留下次查询时间；在总等待期限内，执行进程中断且租约到期后可继续 GET 同一任务。有效租约期间不重复投递，接收新租约后忽略旧执行者的完成；没有上游任务 ID 的付费提交仍转待核对，不自动重发 POST。成功恢复时清理历史错误码，沿用原扣费。

## 明确失败任务的渠道修正重试

旧任务固定了旧协议时，后台改协议后重试不能继续复用旧快照。仅当所有当前子项均明确 failed、且是用户主动重试时，事务内重新解析当前启用渠道；旧快照留在原子项 reconciliation_evidence，退款／扣费／替换／outbox 仍原子执行。重试幂等键先于配置更新检查，渠道不可用或余额不足整体回滚。在途、部分成功或 needs_reconciliation 不借此覆盖快照。

## 已下线的模型

Grok 与 Seedream 已从可选目录和新任务路由移除，已有任务与素材名称保留。Images 适配器仍对这两个上游省略 `quality`，它们未声明质量枚举。

## 套图计划的语言分析

语言分析与图片渠道分开：`model_planners.tool='smart-variation'` 配置 HTTPS 源地址、`upstream_model='claude-sonnet-5'`、超时与启用状态，`provider_id` 引用现有中转站的默认加密密钥。读取时要求中转站同样启用，通过 `MODEL_CREDENTIAL_SECRET` 解密。密钥不写入计划、前端、日志或 Git。当前独立管理应用尚无此配置表的编辑页面；本地由显式 SQL 配置，部署前须迁移并配置目标环境，不能把本地配置视为线上已生效。

后台历史配置 `protocol=anthropic-messages`，使用 Claude 原生 `POST /v1/messages`，`x-api-key` 与版本头鉴权，文字需求及最多5张授权PNG缩略图以base64内容块输入，输出JSON计划。保留独立的 `openai-chat` 适配用于其他中转站，协议在服务端配置，不自动跨协议重发。现配置语言地址 `https://api.uselg.top`，与图片地址分开；前端只调用业务 `/variation-plans`，不直连供应商。图片里的文字不作为指令，结果严格验证为1–10条标题和独立提示词，不接受截断、空结果或重复提示词。

计划按企业及用户隔离，分析不扣图片积分，每用户每分钟最多3次新分析。相同幂等键只读已有状态，不重复请求模型；网络超时标记 `uncertain`，进程中断超过120秒的运行记录同样转待确认，不自动补发。分析成本由模型供应商账单记录，当前没有单独向用户收取分析积分。

`generation_jobs.input.variation` 保存用户确认后的方案快照；服务端校验计划所有权和参考图一致性，固定 Image 2.5，沿用图片任务的原子扣费及outbox。Worker按方案位置提取对应提示词，每次 `count=1`，不会把整组数量传给每个方案。重复创建、失败退款与不明确付费结果沿用现有任务机制。

### 主站试用独立模式

浏览器从主站代码和本地静态资源读取四个模型的名称、说明及 Logo，不请求管理后台模型目录。生产使用 `STANDALONE_MODELS=true` 的服务端固定路由，密钥通过 Workers Secrets 配置。普通生图、家纺裂变和套图计划共用真实鉴权、积分、任务、outbox 与私有 R2。模型管理表和管理接口保留独立用途，历史任务沿用已保存的供应商快照，不能把未决尝试自动改投新渠道。

### 主站独立计划服务

`STANDALONE_MODELS=true` 时，套图计划固定直连 DeepSeek 官方 `https://api.deepseek.com/chat/completions`，模型 `deepseek-flash`，不读取后台语言渠道或使用语言中转站。`DEEPSEEK_API_KEY` 使用 DeepSeek 官方 Key，仅在 API 服务端配置；图片生成仍用独立的 `STANDALONE_IMAGE_API_KEY`。保留后台表和其他协议适配供后续管理功能使用。

规划请求只发送文字需求和参考图编号，不发送图片内容，不虚构商品视觉分析，见[套图计划](image-generation-api.md#套图计划)。依据[思考模式文档](https://api-docs.deepseek.com/guides/thinking_mode/)显式 `thinking.type=disabled`，避免默认开启思考；使用 JSON 输出、`max_tokens=8192`、单轮请求和简短独立提示词来控制费用。最多20条，按用户指定的张数或颜色、场景、视角等目标列表确定数量；如“红色、蓝色、白色”为3条，“换成红色，白色部分不变”为1条，未指定数量或变化项时只生成1条；不为省成本减少用户要求的方案数。保留60秒超时、取消、幂等、严格结果校验，不自动重发。

## 提示词优化

主图制作、首页、套图计划和视频创作复用魔法棒，点击后在提示词框底部确认消耗 1 积分。服务端使用官方 DeepSeek Chat Completions，关闭思考模式。改写保留用户原意、明确约束、指定文字和已有的 `@图片N` 引用，只补充出图所需的细节。请求仅发送文本。

- `POST /api/v1/prompt-optimizations` 使用企业身份和可信来源检查，请求含 UUID 幂等键及 `{prompt, tool}`。响应逐段发送 `delta`，`complete` 返回持久化的完整结果。客户端在流结束前仅展示预览，结束后才更新可编辑草稿。
- 领取时原子扣 1 积分并写入请求记录，同键重放返回原结果。失败或服务端在结算前收到取消时退回积分。异常中断后，超过两分钟的未结算请求在该用户再次发起优化时退回积分。连接中断时当前页面可用原键核对结果。
- 提示词优化依赖当前 PostgreSQL 迁移链中的 `0042_prompt_optimizations.sql`。先完成追加迁移再部署 API；SSE 请求使用 Workers 支持的请求选项，并在流结束或取消后关闭调用级数据库连接。真实模型费用只由用户授权的线上操作产生。
