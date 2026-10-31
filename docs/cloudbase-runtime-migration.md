# CloudBase 后端运行迁移记录

更新：2026-10-31。代码与共享 PG 事务适配已完成本轮验证，三个运行包已构建；云函数创建被插件的凭据核对拦截，候选服务与正式入口尚未发布。

## 数据与上传边界

目标为上海个人版环境 `lycobo-d9gyvxkegc54a1257`，共享 PostgreSQL，不开通独享 PG 或额外云托管套餐。现有 JPEG、PNG、WebP 上传入口保持不变，服务端统一保存 PNG 和 WebP 展示变体。

源库与对象仍保留，旧服务未停止。2026-10-31 22:45 上海时间再次只读比较，源库 43 张表的行数和全行内容指纹均与已复制快照一致。有 1 条既有 `needs_reconciliation / WORKER_OUTCOME_UNKNOWN` 任务，迁移保留其待核对状态，不自动重新提交供应商、退款或补扣费用。候选包的 API 和消费者均计划设置 IMAGE_GENERATION_ENABLED=false。

## 共享 PG 仓储

浏览器仍请求业务 API，不直接使用服务端 CloudBase API Key。保留原企业账号、密码哈希、JWT、Cookie/CSRF 和组织成员关系。Node API 拒绝同时配置 CloudBase 与 DATABASE_URL，防止两个库混用。

鉴权 8 个固定 RPC 覆盖限流、凭据读取、创建会话、身份、单次刷新、改密、撤销和管理端设置凭据。改密与会话删除在同一个数据库事务内完成，刷新使用条件 UPDATE 防重放。

图片运行仓储通过固定操作分支承接主站任务提交、钱包查询/扣费/退款、幂等重试、归属校验、素材、裂变计划、outbox 租约、任务认领、供应商轮询、完成、超时保留及人工核对。SQL 不接收任意语句或标识符。执行与账务保持原子性，外部供应商调用仍在事务之外。

本次迁移沿用主站当前 STANDALONE_MODELS=true 的模型配置。ImageRuntimeRepository 将运行接口与管理端写入、账号初始化、支付内部接口分开；原 PostgreSQL 管理工具保留，不能将其视为已迁移到 CloudBase 的管理端。独立 admin 的完整迁移不在本轮主站发布内，切换前仍须协调其对源共享表的写入。

事件使用数据库持久游标和按组织 3 秒轮询，不依赖 TCP LISTEN。API SSE 保留到期重连与鉴权撤销检查；HTTP 云函数计划超时 900 秒，SSE 应用自身 10 分钟结束，实际平台流式传输仍待候选域名验收。

## 运行服务与包

- `lycobo-api`：HTTP 云函数，Hono，企业鉴权、业务 API、事件流；监听 0.0.0.0:9000。
- `lycobo-assets`：HTTP 云函数，签名绑定对象/用途/过期时间；校验 Origin/Referer 后读取私有云存储。默认不使用进程缓存，沿用既有授权测试。
- `lycobo-consumer`：独立 Event 云函数，完整等待任务处理；PostgreSQL outbox/claim 为持久来源，两个执行并发、每次最多 20 条。不在 HTTP API 中执行后台付费请求。定时触发器待资源创建后配置和验证。

`scripts/cloudbase/prepare-runtime.mjs` 在仓库外空目录构建 Nodejs20.19 包，外部依赖固定版本，为 Sharp 下载 Linux x64/glibc 二进制；包只含编译代码、依赖和启动文件，不含 .env、用户图片、数据库备份或源目录。两个 HTTP 包含可执行 scf_bootstrap，Event 包使用 index.main。

已构建并检查三个候选包，API 约 24 MiB、资源服务约 832 KiB、消费者约 21 MiB（解压后）。本地不能执行 Linux 原生 Sharp，因此仍需云端实际启动验收。

## 目标迁移与实测

| 迁移版本 | 内容 | CloudBase 任务 |
| --- | --- | --- |
| 20261031223400 | 鉴权固定函数 | task-3c433c92717c40a9 |
| 20261031223500 | 图片、钱包、任务及事件固定函数 | task-e59aed1de9394645 |
| 20261031223600 | 运行凭据权限收紧 | task-0c48e2ba52984463 |

三个迁移均经过 plan、apply、任务成功及远端历史验证。运行角色不能创建 public 对象，不能直接读写 public 业务表或序列；只授予固定业务函数执行，内部辅助函数不向 service_role 开放。CloudBase 系统 auth/storage schema 不受本次撤销影响。

实际目标数据面验证：鉴权不存在会话返回 HTTP 200/null；storageUid、wallet、listAssets、eventsLatest 返回 HTTP 200；同一运行凭据直接读取 enterprise_accounts 返回 HTTP 403。43 张业务/迁移表的 service_role 直接授权计数为 0；anon/authenticated 无业务函数执行权限。

## 隔离验证

已补齐 PostgreSQL 17.11 专用 loopback 实例，不注册开机服务。原始 source.dump 在全新隔离数据库恢复后，43 表、1,156 行内容指纹全部匹配，钱包汇总差异 0、无效约束 0；私有报告保存在忽略的 backups 目录。

完整根 test:integration 已通过，新增两个检查每次新建独立数据库并在结束后删除，不访问远端生产数据：

- db test:cloudbase-auth：凭据条件、并发刷新仅一次、组织身份、改密撤销会话、anon/authenticated 拒绝执行。
- api test:cloudbase-images：并发提交/认领/outbox、重复提交一次扣费、余额不足回滚、幂等冲突、退款不重复、显式重试、旧令牌拒绝、异步轮询、不确定结果不退款、核对退款、跨组织素材隔离、裂变计划、事件游标、service_role 仅能经函数访问。

主站与旧运行路径的单元、类型和构建检查通过；完整本地浏览器 E2E 未运行，候选端到端测试尚未进行。所有集成只使用本地 fixture，不调用付费供应商。

## 部署拦截及后续

三个 createFunction 调用均被 CloudBase MCP 凭据护栏拒绝，返回 `[credential] status=instant executed=false`：客户端在 1–15ms 返回凭据核对，被判定不可能包含人工原始来源比对。没有实际创建函数，没有开放网关或切换正式入口，也没有修改跳过护栏开关。

后续依次完成：合法的凭据核对/原始文件引用部署、三个服务实际启动、同源网关（/ → STATIC_STORE，/api 完整路径透传到 API，/_images 剥前缀到资源服务）、候选鉴权/素材/SSE/上传验证、源端停写与最终数据库/对象复核、正式入口切换、启用消费者触发器。确认初始部署完成后，才设置 GitHub Environment 变量 CLOUDBASE_RUNTIME_READY=true 启用后续自动代码更新。

护栏明确建议改用引用方式。已准备 `scripts/cloudbase/bootstrap-runtime.mjs`：使用官方 CLI 的配置文件方式，直接读取本机原始环境值，生成包外 0600 临时配置，部署结束删除；凭据不经过聊天转写、不进函数包。该替代入口尚未执行，等待用户确认采用这一方式；不修改护栏跳过开关。
