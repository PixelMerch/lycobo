# 模型服务后台与执行适配

2026-10-27。当前仅本地 Docker 建表与验证，未部署线上或修改 Supabase。

## 身份与服务边界

独立后台位于相邻 lycobo-admin 仓库，页面 http://localhost:8082/#model-services，登录 http://localhost:8082/login。后台 API 自己认证、执行 Casbin 菜单／按钮授权、管理配置和密钥，不调用主站企业账号登录。主站 /api/v1/model-management 已移除，图片 API／生成 Worker 仅消费模型能力、路由和已接收任务快照。

后台管理员存放 admin_users，会话在 admin_sessions，角色在 admin_roles，绑定在 admin_user_roles，登录限流在 admin_login_limits；均无业务 users 外键。新增迁移 0022、0023 已在本地执行。本地 admin 账号由显式初始化脚本创建，密码不写入迁移或源码。

当前是进程、身份和权限域分离，仍共享本地 PostgreSQL 实例及模型配置表，不代表物理数据库拆分。旧 platform_administrators 表保留兼容数据，不再用于后台授权。model_audit_events 新增 administrator_id 指向独立管理员；actor_id 可为空，仅保留旧审计证据。

## 配置步骤

1. 中转站：名称、HTTPS 源地址（如 https://api.ai-media.vip，不含 /v1）、协议、API Key、启用状态。默认禁用；Key 保存后只显示已配置，编辑留空保留旧值。
2. 模型渠道：选择中转站、前台模型、任意合法上游模型 ID、执行方式、参考编辑与上限、分辨率、提交超时、总等待上限和额外下载源。
3. 默认路由：按图片创作／家纺主图裂变／局部修改及前台模型绑定一个渠道。默认渠道禁用或能力不匹配时拒绝新任务，不自动跨站提交。

前台公开模型仍为 gpt-image-2、gpt-image-2.5、nano-banana-2.1，只读取公开能力；上游名称独立配置，例如家纺 gpt-image-2-4K。未绑定组合继续兼容原环境变量渠道，不自动启用新站。

支持 OpenAI 兼容同步图片（文生图 JSON、编辑 multipart）及 FluxPort 图片协议（JSON 参考图、同步或异步）。执行方式可选同步、异步优先、供应商默认；异步优先也接受同步图片响应。新站同协议可只填配置，不同协议仍需服务端适配，不能填写可执行脚本。

连接检查只请求 /v1/models，不发起付费生图，不证明模型、额度和参考图能力通过验收；缺少模型列表接口不等于不能生成。

## 加密与数据

MODEL_CREDENTIAL_SECRET 必须为 32 字节随机数的 Base64，独立后台 API 和生成 Worker 使用相同值；本地已分别保存在两个仓库忽略的 .env 中，不能放入 VITE_* 或 Git。密钥独立备份，直接更换会使旧记录无法解密；本轮未实现主密钥轮换。生产上线前需单独授权迁移并配置 Secrets。

供应商 Key 使用 AES-GCM 加密且版本不可覆盖；换 Key 新建版本，在途任务使用原版本。model_providers 保存中转站，model_credentials 保存密钥版本，model_channels 保存渠道能力，model_routes 保存默认映射，provider_executions 保存异步 ID／查询路径／租约／截止时间／失败次数，model_audit_events 保存操作者与动作。任务 generation_jobs.provider_snapshot 固定配置，不在公共任务返回值中暴露。既有表名未更改；管理和执行新表启用 RLS，不向匿名用户开放。

## 异步、存储和计费

任务、积分和 outbox 原子提交，每个视角一个子任务。付费 POST 只执行一次；202 后保存 task ID、同源查询路径和下次查询时间，结束消费。后续通过 outbox 维护和 Cron 调度 GET，不在 Worker 长时间等待。poll_after_ms、Retry-After 与指数退避决定最早查询时间，实际受维护间隔和 Cron 粒度影响。

成功后拉取真实图片到私有 R2，再完成任务。摘要 result_url 作为任务 JSON 结果接口继续查询，不当成图片下载。下载仅允许源站与明确配置的 HTTPS 源；不把 Key 发往第三方 CDN，拒绝重定向。

明确失败逐项退款；结果不确定、查询停止或总等待超时转待核对，不自动重复付费提交。连续查询网络／限流／服务错误最多五次后停止。显式用户重试沿用原账务与审计语义。刷新后台、改配置、队列重复投递不重复扣款。

未实现 webhook、自动跨站重试、自动价格同步或任意新增前台模型。本轮未新增供应商真实付费验收。

## 验证和后台规范

主站 pnpm check 与本地 opt-in pnpm test:integration；独立后台 pnpm check，独立临时库身份／Casbin／审计集成测试，浏览器登录、角色勾选、管理员分配及低权限隐藏验收。fixture 不调用付费模型。临时界面验收账号与角色清理后只保留初始化的 admin。

后台全部页面必须登录，操作反馈使用顶部 HeroUI Toast，访问受限用弹框，登录页仅保留必要表单。管理员与角色为真实持久化，首页、任务和账务仍为演示。细节见相邻 lycobo-admin/docs/admin-access.md。
