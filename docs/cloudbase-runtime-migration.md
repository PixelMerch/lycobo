# CloudBase 后端运行迁移记录

更新：2026-11-01。主图制作、家纺套图、智能裂变均已在 CloudBase 实际生图并保存到私有云存储。当前固定使用默认同源网关，自定义域名暂不接入；旧 API 和消费者的生图已关闭，原数据与对象保留。

## 当前真实验收

API 和消费者的 IMAGE_GENERATION_ENABLED 均已开启；消费者的 `lycobo-outbox-minute` 定时触发器按 `0 * * * * * *` 运行。原 CLI 配置更新遇到交互选择时会以 0 退出却未执行，因此本次使用 CLI `--yes` 明确选择已核对的完整变量覆盖，并通过模型能力响应与真实任务确认生效。运行密钥仅从原本机文件引用，临时配置在包外、权限 0600，已删除。

三个功能各实际生成一张 1.5K、1:1 图片，均成功；智能裂变先完成真实分析计划再确认生成。三张原图为 1254×1254 PNG，预览为 WebP、缩略图为 512×512 WebP，9 次实际 GET 均 HTTP 200。对象表当前 480 个对象、120 条未删除素材，包含原复制的 116 条素材和本次一张参考图、三张结果。图片没有写回 R2。

验收使用现有管理员所属钱包；三条 consume 记录合计 -6，钱包与流水核对差异 0。未伪造账号或余额，结果与付费记录真实保留，具体余额仅保存在私有验收记录。最初一张因供应商地址尾部 `/` 导致下载校验误判，修复为规范化 origin 后，通过原任务结果恢复取图，未再次提交生成或扣费。CDN 域名白名单、手动重定向及凭据隔离仍保留。

智能裂变确认发现 SQLSTATE 42702，已追加并应用 `20261031235900_variation_plan_confirmation.sql`（任务 task-9b7fdbbae8974e21，Succeed，历史回查通过）。仅消除变量/列歧义，函数 SECURITY DEFINER、固定 search_path 和执行权限均已回查保留。首次失败事务未创建任务或扣费；修复后复用原计划和幂等键成功。

源库最终业务复核没有新增任务、素材或账务，差异为一条会话撤销；该撤销已单向同步到目标，并保留目标新登录会话。原有一条 WORKER_OUTCOME_UNKNOWN 待核对记录未自动重提或退款。独立 admin 尚未迁移，不能继续用它向旧库调整新站余额或配置。

代码检查：pnpm check 通过（51 文件、253 项通过、1 项原有跳过）；新增隔离 PG 回归先复现 42702 再通过，覆盖计划确认、单次扣费、outbox 和退款。关闭服务时参考图误提示的单项 Chromium 回归通过；未运行全量浏览器 E2E。GitHub 分块自动发布仍需以实际运行结果为准。

## 数据与上传边界

目标为上海个人版环境 `lycobo-d9gyvxkegc54a1257`，共享 PostgreSQL，不开通独享 PG 或额外云托管套餐。现有 JPEG、PNG、WebP 上传入口保持不变，服务端统一保存 PNG 和 WebP 展示变体。

源库与对象仍保留。首次候选部署阶段，2026-10-31 22:58 上海时间只读比较源库 43 张表的行数和全行内容指纹，均与复制快照一致。有 1 条既有 `needs_reconciliation / WORKER_OUTCOME_UNKNOWN` 任务，迁移保留其待核对状态，不自动重新提交供应商、退款或补扣费用。首次候选包的 API 和消费者使用 IMAGE_GENERATION_ENABLED=false，当前状态以上方真实验收为准。

## 共享 PG 仓储

浏览器仍请求业务 API，不直接使用服务端 CloudBase API Key。保留原企业账号、密码哈希、JWT、Cookie/CSRF 和组织成员关系。Node API 拒绝同时配置 CloudBase 与 DATABASE_URL，防止两个库混用。

鉴权 8 个固定 RPC 覆盖限流、凭据读取、创建会话、身份、单次刷新、改密、撤销和管理端设置凭据。改密与会话删除在同一个数据库事务内完成，刷新使用条件 UPDATE 防重放。

图片运行仓储通过固定操作分支承接主站任务提交、钱包查询/扣费/退款、幂等重试、归属校验、素材、裂变计划、outbox 租约、任务认领、供应商轮询、完成、超时保留及人工核对。SQL 不接收任意语句或标识符。执行与账务保持原子性，外部供应商调用仍在事务之外。

本次迁移沿用主站当前 STANDALONE_MODELS=true 的模型配置。ImageRuntimeRepository 将运行接口与管理端写入、账号初始化、支付内部接口分开；原 PostgreSQL 管理工具保留，不能将其视为已迁移到 CloudBase 的管理端。独立 admin 的完整迁移不在本轮主站发布内，切换前仍须协调其对源共享表的写入。

事件使用数据库持久游标和按组织 3 秒轮询，不依赖 TCP LISTEN。API SSE 保留到期重连与鉴权撤销检查；API HTTP 云函数超时 900 秒，SSE 应用自身 10 分钟结束。候选域名实测返回 text/event-stream、首块 42 字节正常到达；长时稳定性和完整重连仍主要依赖隔离集成覆盖。

## 运行服务与包

- `lycobo-api`：HTTP 云函数，Hono，企业鉴权、业务 API、事件流；监听 0.0.0.0:9000。
- `lycobo-assets`：HTTP 云函数，签名绑定对象/用途/过期时间；校验 Origin/Referer 后读取私有云存储。默认不使用进程缓存，沿用既有授权测试。
- `lycobo-consumer`：独立 Event 云函数，完整等待任务处理；PostgreSQL outbox/claim 为持久来源，两个执行并发、每次最多 20 条。不在 HTTP API 中执行后台付费请求。消费者已实际调用并返回 enabled=false、processed=0；正式切换前不启用定时触发器。

`scripts/cloudbase/prepare-runtime.mjs` 在仓库外空目录构建 Nodejs20.19 包，外部依赖固定版本，为 Sharp 下载 Linux x64/glibc 二进制；包只含编译代码、依赖和启动文件，不含 .env、用户图片、数据库备份或源目录。两个 HTTP 包含可执行 scf_bootstrap，Event 包使用 index.main。

已构建并检查三个候选包，API 约 24 MiB、资源服务约 832 KiB、消费者约 21 MiB（解压后）。三个函数已全部 Active，内存 512 MiB、Nodejs20.19，超时 API/消费者 900 秒、资源服务 60 秒；云端 JPEG 上传与 PNG/WebP 变体实测成功，确认 Linux Sharp 运行正常。

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

主站与旧运行路径的单元、类型和构建检查通过：50 个文件、248 项通过、1 项跳过；完整本地浏览器 E2E 未运行。新增候选验证仅执行鉴权、读取和临时图片上传，不调用付费供应商。

## 实际候选部署与验收

候选入口：[CloudBase 主站](https://lycobo-d9gyvxkegc54a1257-1311968085.ap-shanghai.app.tcloudbase.com/)。这是腾讯云测试域名，浏览器首次打开会展示平台访问提示。

原 MCP 凭据核对因客户端未展示弹窗而失败；按插件建议采用原始文件引用方式，官方 CLI 直接读取本机 .env，使用包外 0600 临时配置部署。没有修改跳过护栏开关，临时配置已删除，凭据未进入 Git 或函数包。

三个函数均 Active；网关已配置：/ → STATIC_STORE，/api 完整路径透传到 API，/_images 剥前缀到资源服务。前端构建产物已上传共享静态托管，浏览器首页、工作区深链刷新和企业登录弹窗均正常，JS/CSS 返回 200。

实际使用快照中的有效会话做服务端鉴权验收，未创建测试账号或修改余额：

- 企业 session、钱包、素材列表 HTTP 200；匿名素材列表 HTTP 401。
- SSE HTTP 200 / text/event-stream，首块正常到达。
- 预览、缩略图、下载访问成功；缺少来源与修改用途的签名请求 HTTP 403。
- 临时 32×24 JPEG 上传返回 201，保存 MIME 为 image/png；实际 GET 预览和缩略图为 WebP，下载为 PNG，尺寸保持 32×24。
- 临时测试的 4 个对象、素材行、事件行及公开编号注册行已精确清理。再次计算目标 43 张表的内容指纹，与源快照全部匹配；正常保留序列递增产生的空号，不回退已使用游标。
- 消费者云端手动调用成功：enabled=false、processed=0，无供应商调用。

GitHub cloudbase-production Environment 已配置 CLOUDBASE_RUNTIME_READY=true。发布 PR #33 已在 CI 通过后合并，main 提交为 b7a4b70；两个长期分支已同步。首次 GitHub 发布停在 CLI 临时 COS 上传，已停止该任务并采用环境自有桶的两段式代码上传修复，详见 [部署传输修复](cloudbase-deployment.md#自动发布传输修复)。新流程实际验证仍在进行。

## 自定义域名历史与后续边界

lycobo.com 已有 CloudBase 域名配置和证书，但平台状态 FAIL；实际创建 API 路由返回“域名未备案；如果域名已经完成备案，由于腾讯云与工信部数据需要同步，请在1小时后重试”。未修改 DNS，也没有停止原站。

当前 device 登录实际以 TCB_QcsRole 调用（STS 已确认），不具备 DNSPod 读取权限。用户已确认暂不接入自定义域名，本次不修改 DNS、不扩大该角色权限，也不以备案作为默认入口的启用条件。

尚需完成 GitHub 分块自动发布验证。新站三个功能已经开启并真实验收，默认入口固定，旧 API/消费者生图已关闭；独立 admin 仍待接入目标库。自定义域名明确暂缓，不列为本次交付待办。
