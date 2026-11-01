# CloudBase 自动部署与私有图片存储

更新：2026-11-01。目标为上海个人版环境 `lycobo-d9gyvxkegc54a1257`，不升级套餐。主站三个功能已实际生图并保存私有云存储，API/消费者生图开关和每分钟定时触发均已启用，见 [真实验收记录](cloudbase-runtime-migration.md#当前真实验收)。

按用户确认，当前固定使用默认入口：https://lycobo-d9gyvxkegc54a1257-1311968085.ap-shanghai.app.tcloudbase.com/ 。前端、API 和图片资源共用该网关；后续部署更新同一环境的服务和文件，不更换入口。自定义域名暂不接入，不将备案或 DNS 作为本次交付条件。

## GitHub 自动发布

`.github/workflows/deploy-cloudbase.yml` 替代已删除的 Cloudflare 发布工作流：main 的 push CI 成功 → 检出该 SHA → 确认仍为最新 main → 冻结安装依赖 → 构建前端（同一提交已在 CI 通过 `pnpm check`，发布时不再重复）→ 准备前后端包 → 更新已配置的三个云函数代码 → 验证 API → 发布共享静态托管。dev 和 PR 不发布；手动触发也只允许 main，且必须有该 SHA 对应的成功 push CI。

发布前再次检查 main，避免构建期间已有新提交却发布旧版本。同一环境的发布串行执行，不自动运行完整浏览器 E2E，不迁移数据库或上传业务运行密钥。

Actions 中完成构建，临时发布目录只复制 `apps/web/dist`。准备脚本拒绝环境文件、备份、服务器函数和符号链接；不上传仓库根目录、`.env` 或图片数据。Node/pnpm 沿用仓库固定版本，CLI 固定为 `@cloudbase/cli@3.8.11`，已通过实际 help 核对参数。

使用 `tcb hosting deploy --safe --verify` 将独立 Vite 产物发布到共享静态托管，忽略准备目录中的应用配置文件、不使用 prune。网关默认 HTTP 域名统一挂载前端、`/api` 和 `/_images`，保证 Cookie 同源。当前静态托管已启用，首页和错误页均已配置并回查为 `index.html`，支持 SPA 深链刷新。默认域名为平台测试入口，自定义域名另行核对备案、证书和套餐能力。

候选访问入口为 `https://lycobo-d9gyvxkegc54a1257-1311968085.ap-shanghai.app.tcloudbase.com/`。`tcloudbaseapp.com` 只承载静态文件，不含业务 API；发布包在应用启动前将该项目的静态域名页面转到网关，并保留路径、查询和片段。网关、自定义域名和本地开发不跳转，Cookie 继续使用同源策略。

## 部署凭据

GitHub 已创建 `cloudbase-production` Environment，仅允许 main 部署。凭据持有人须在该 Environment Secrets 中配置：

| 名称 | 内容 |
| --- | --- |
| `TCB_SECRET_ID` | 本项目部署身份的腾讯云 SecretId |
| `TCB_SECRET_KEY` | 对应 SecretKey |

权限限定到本项目发布所需能力，不使用主账号无限制密钥。数据库密码、企业 JWT 主密钥和图片供应商 Key 不进入前端部署环境。临时 device 登录授权不能复制到 GitHub 长期使用。

首次三个函数创建、服务端变量、同源网关与候选读写检查均已完成，Environment 变量 `CLOUDBASE_RUNTIME_READY` 已设置为 `true`。后续 CI 使用固定版本 CloudBase MCP 的两段式代码上传，仅更新代码并保留云端运行凭据和配置；不会自动创建不完整后端或应用数据库迁移。

Secrets 仅在发布登录与后端代码传输步骤注入，不传入前端构建；任务结束后执行 CLI logout。代码进入 main、Secrets 配置完成并实际运行前，不能宣称 GitHub 自动发布已跑通。本地提交不会自动推送或触发发布。

GitHub 中的两个 Secret 已通过实际 MCP 认证和函数查询；GitHub 不允许读取原值，代码发布权限仍须以实际发布结果验证。`TCB_SECRET_ID` 应为腾讯云 AKID 开头的 SecretId；工作流会提前拒绝将服务端存储 API Key 误填为发布身份的情况。控制台中的 `lycobo-private-storage` 资源 API Key 不用于这两个发布 Secret。

## 主站私有图片

主站使用 CloudBase PG 原生存储 `lycobo-images` 私有桶，不使用旧 NoSQL COS 接口。[追加迁移](../cloudbase/migrations/20261031223300_private_image_storage.sql) 限定单对象 32 MiB、PNG/WebP。原图、兼容 PNG 缩略图、WebP 预览及缩略图保留原对象 key 约定。新生成和上传的图片只写入原图与两个 WebP 变体；兼容 PNG 缩略图（实测平均 497 KiB，是 WebP 缩略图的 16 倍）只有智能裂变规划会读取，首次读取时从原图生成并保存。

服务端配置如下，禁止使用 VITE_ 前缀：

```dotenv
CLOUDBASE_ENV_ID=lycobo-d9gyvxkegc54a1257
CLOUDBASE_STORAGE_BUCKET=lycobo-images
CLOUDBASE_APIKEY=<server-api-key>
```

`CLOUDBASE_APIKEY` 是资源数据面服务端凭据，不是 GitHub 发布密钥或浏览器 Publishable Key。此次经管理接口签发 `lycobo-private-storage` 运行凭据，只保存在被忽略、权限 600 的本地 `.env`；发布后端时仍须注入服务 Secrets。管理员在 CloudBase API Key 管理中撤销/轮换，并同步更新运行服务。凭据不进入文档或前端。

桶和对象表保留默认 RLS 拒绝，不开放 anon/authenticated 直接读写；后端 service_role 访问前由业务 API 验证企业身份和素材归属。资源访问保留绑定对象、用途和到期时间的签名，不改成永久公开链接。

`cloudbase-object-bucket.ts` 实现已实测的 PG HEAD/GET/PUT/DELETE，固定目标网关、30 秒超时、不跟随重定向、错误脱敏。一旦配置 CloudBase，404、鉴权错误、超时或服务故障均不会回退旧 R2/S3，避免已删除素材重新出现。

Node API 的 `object-image-store.ts` 使用 Sharp 完成解码校验、去元数据、PNG 原图和展示变体生成，无需 Cloudflare Images。付费原图先落盘到私有云存储，变体失败保留原图。旧运行时源文件也接入同一存储选择逻辑；CloudBase 三功能已开启并真实验收，正式域名尚未切换。

## Cloudflare 退出边界

已删除旧发布工作流、四个生产 `wrangler.jsonc`、Pages Functions 转发入口、远端 setup/deploy 脚本及根命令。日常 build 不再执行 Wrangler 发布 dry run。

workerd/Miniflare、旧运行时源码和 `scripts/cloudflare` 剩余文件仅用于隔离开发/回归及尚未完成的运行时迁移。本地配置从无 account_id、生产队列或 Cron 的模板生成，保留原本地存储名称和已有数据。本地启动丢弃 CloudBase、腾讯云及旧 Cloudflare 的远端凭据。

远端旧资源、源库和对象保留供回溯，旧 API/消费者的生成开关已关闭。新站主站业务读写使用共享 PG、独立消费者和资源服务；三个功能已实际生成并存储图片。独立 admin 未接入目标。当前只使用上述默认网关；自定义域名以后按需处理，不在本次接入范围内。

## 验证与状态

- 私有桶实测 PUT/GET/HEAD/DELETE 成功，字节匹配，匿名无法读取；临时对象已清理。
- 部署包隔离、存储不回退、凭据/路径校验、重定向、原图及变体失败边界由单元测试覆盖。
- 工作流通过 actionlint；GitHub 实际发布需补齐 Secrets 并在 main CI 后运行。
- 图片复制结果见 [图片存储迁移](cloudbase-storage-migration.md)。独立 admin 的公开 Logo 存储不在本轮主站私有图片范围内。

官方参考：[CLI 函数代码更新](https://docs.cloudbase.net/cli-v1/functions/code-update)、[CI/CD 集成](https://docs.cloudbase.net/hosting/cli-devops)、[PG 云存储](https://docs.cloudbase.net/api-reference/webv3/storage)。

后端共享 PG 适配进度及实际验证见 [运行迁移记录](cloudbase-runtime-migration.md)。鉴权、任务、钱包和事件 RPC 已应用目标，运行角色直访业务表已拒绝；三个服务均 Active，候选前后端、鉴权、JPEG 上传及变体访问已验证；正式域名未备案，旧入口尚未切换。


本次首次部署已使用替代入口：`node --env-file=.env scripts/cloudbase/bootstrap-runtime.mjs <准备好的运行目录>`。该入口通过官方 CLI 配置文件直接引用原始本机凭据；临时配置在函数包外、权限 0600，并在结束时删除。它不打开网关、不启用生图或定时器。MCP 凭据核对因客户端没有弹窗未能执行，本次按其引用指引直接读取原始配置，通过官方 CLI 完成部署。


## 自动发布传输修复

发布 PR #33 已合并到 main（b7a4b70），main Quality/Infrastructure 均通过。首次 GitHub 发布在 CLI 的临时 COS 上传阶段没有完成，已停止该任务，未修改运行配置或前端。

后端改用 `scripts/cloudbase/deploy-runtime.mjs`：固定 @cloudbase/cloudbase-mcp 2.36.2、MCP SDK 1.32.2、COS SDK 3.0.0，依赖仅安装到 runner 临时目录，不进入应用包或根锁文件。MCP 获取环境自有 COS 桶的上传能力，限制区域、桶、代码前缀和函数名；三个代码包同时传输，COS SDK 按 1 MiB 分块、每包最多 16 路并发，单请求 90 秒空闲超时、最多三次刷新目标重试，仅输出百分比和脱敏错误码。MCP 工具调用逐个发出，仅 COS 传输并发。全部代码包传输成功后，才按 consumer → assets → api 顺序通过 MCP 逐个提交代码更新；任一传输失败则不切换任何函数，并删除已传对象。函数恢复 Active 且修改时间变化后，用 COS SDK 删除本次代码对象；某个函数切换失败时保留其已提交对象，只删除尚未提交的对象。管理凭据仅存在于进程内，不输出或写入应用配置。

MCP 安装在登录前的独立步骤完成（5 分钟上限），发布进程直接启动已安装的入口，避免发布时隐式下载。后端跨地域分块传输已有实际进度，步骤上限调整为 20 分钟，整体任务仍为 30 分钟；日志仅记录动作、传输进度和脱敏错误，不包含参数、响应、凭据或上传地址。

本地已用同一两段式入口实际更新三个服务并确认 Active，三个临时代码对象已删除。针对 URL/桶/用途校验、错误脱敏、上传失败重试和代码提交顺序的专项测试通过。新工作流仍需 GitHub 实际运行验证。

GitHub 第三轮发布已确认 MCP 启动和认证成功，但单次 PUT 连续三次在 90 秒超时；随后改为上述分块上传。本地已通过该路径再次更新三个服务，云端变量和定时器保留。GitHub 分块发布结果须以实际 Actions 运行结论为准。

跨境传输瓶颈：GitHub 发布 #5 的后端三个函数均已更新，但步骤恰好超过当时的 10 分钟上限；#6（ffdbfa8）在 20 分钟上限下成功，后端步骤耗时 10 分 9 秒。日志显示 consumer（8.8 MB）与 api（9.3 MB）在 3 路分块下各需 260–285 秒（约 31–36 KB/s），而静态托管 20 路并行上传 93 个文件约 4 MB 仅用 22.7 秒（约 180 KB/s）。runner 到上海 COS 的单连接约 10 KB/s，总速率随连接数增长，因此改为上述全部代码包、全部分块同时传输：当前三个包共 19 个分块同时在途。本地使用固定版本 COS SDK 对接本机模拟端点，确认旧配置最多 3 个分块在途、新配置 19 个分块同时在途；预计传输阶段从约 9.5 分钟降至约一个 1 MiB 分块的耗时（约 2 分钟），实际效果以下一次 Actions 运行为准。

函数代码的 `CodeSha256` 与平台存储的 zip 一致，但平台会改写 HTTP 函数 `scf_bootstrap` 条目的权限和时间，存储包与上传包不同，因此不能据此跳过未变更函数。

静态托管使用 `tcb hosting deploy .` 的默认根路径。CLI 3.8.11 显式传 `/` 会在一致性校验中保留前导斜杠，误报全部 missing 并回滚；省略该参数后本地 94 文件发布成功，verified=true、failedCount=0。保留 --safe --verify，不通过关闭校验绕过问题。执行目录必须是独立发布目录，不能用 --cwd 代替进程工作目录后仍传 `.`。

GitHub 使用长期 SecretId/SecretKey，不能调用仅支持临时登录态的 MCP `get_temp_credentials`。COS 传输与清理在 CI 直接读取已配置的两个 Environment Secrets；本地 device 授权才走显式临时凭据接口。凭据仅在内存使用，两条路径均由回归覆盖，缺少配对字段时拒绝回退到其他身份。

## 运行计费优化

2026-11-01 按控制台账单与监控核对个人版（每月 40,000 资源点）的计量方式：共享 PostgreSQL 以 5 分钟为计量单位，任一时段有访问即按 0.5 核计 150 核秒，本环境实测约 14 点/时段（197 点对应 2,073 核秒）；云函数按内存 × 时长计费，实测约 0.13 点/GBs（67.49 点对应 513 GBs）；数据库网关调用另按次计量。

实测主要消耗：

- API 的 SSE 长连接：每个打开的页面持续占用一个 512 MB 函数实例（10 分钟后重连），并每 3 秒查询数据库。2026-11-01 00:00–01:00 API 函数累计执行约 7,500 秒（约 3,750 GBs），普通请求只占很小部分。
- 消费者每分钟定时触发：每次 4 次数据库调用，使共享 PG 全天每个 5 分钟时段都计量，约 4,100 点/天，按月会超过套餐额度。
- 生成中历史列表每 5 秒刷新全部已加载分页，每页 3 次数据库调用。
- 生成排队等待由定时器决定：已有 92 张图的开始等待中位 16 秒、P90 50 秒，运行中位 74 秒、P90 120 秒。

代码调整：

- CloudBase 默认关闭 SSE，前端只轮询未完成任务的详情（见[生图 API](image-generation-api.md#历史记录刷新策略)），空闲页面不访问 API 或数据库。
- 没有输出和参考图的任务不再查询图片位置，生成中每次轮询只需鉴权与任务两次数据库调用。
- API 提交或重试成功后同步唤醒消费者；消费者只用运行角色向 SCF 排队一次异步 drain，同步调用不访问数据库、不执行付费请求。drain 结束时仍有延后读取或剩余意向会自行续排，生成不再等待下一次定时器。
- 由唤醒触发的 drain 跳过事件保留清理和过期参考图清理，这两项留给定时或手动运行。
- 原图保存为启用自适应行过滤的无损 PNG：照片类样图小 11–25%，每百万像素约多 10–20 ms 编码；像素与格式不变。
- 消费者同时让 4 个图片项等待服务商（多图任务的计费时长约减半），图片解码、编码与保存仍最多 2 个并行，保证 4K 输出不超过 512 MB 内存。
- 会话校验在实例内缓存 30 秒，轮询时的数据库调用约减半，见[企业登录](enterprise-auth.md)。

定时器：2026-11-01 01:42（上海时间）按用户要求将 `lycobo-outbox-minute`（每分钟）替换为 `lycobo-outbox-3h`（`0 0 */3 * * * *`），共享 PG 的兜底计量约 115 点/天。生成依赖 API 唤醒与消费者续排：唤醒需要 CloudBase API Key 调用函数的权限和 `TCB_QcsRole` 的 SCF Invoke 权限，须以线上日志为准（无 `CONSUMER_WAKE_FAILED`、`CONSUMER_CONTINUATION_FAILED`）。唤醒失败时任务最长等到下一次 3 小时兜底，有人查看排队任务时 API 每 15 秒补唤醒一次；如线上确认唤醒不可用，应恢复每分钟触发器 `0 * * * * * *`。

PR #40 于 2026-11-01 合并并由部署 #8 发布（后端发布 1 分 30 秒）。01:49 直接以 `{"wake":true}` 调用 `lycobo-consumer`：唤醒调用 141 ms 返回 `woken: true`，20 ms 后异步 drain 启动，未发现待处理任务，261 ms 正常结束，确认运行角色可排队异步调用。API 使用 API Key 调用消费者的唤醒路径仍待首次真实提交后在日志中确认。
