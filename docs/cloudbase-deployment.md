# CloudBase 自动部署与私有图片存储

更新：2026-11-01。目标为上海个人版环境 `lycobo-d9gyvxkegc54a1257`，不升级套餐。主站三个功能已实际生图并保存私有云存储，API/消费者生图开关和每分钟定时触发均已启用，见 [真实验收记录](cloudbase-runtime-migration.md#当前真实验收)。

按用户确认，当前固定使用默认入口：https://lycobo-d9gyvxkegc54a1257-1311968085.ap-shanghai.app.tcloudbase.com/ 。前端、API 和图片资源共用该网关；后续部署更新同一环境的服务和文件，不更换入口。自定义域名暂不接入，不将备案或 DNS 作为本次交付条件。

## GitHub 自动发布

`.github/workflows/deploy-cloudbase.yml` 替代已删除的 Cloudflare 发布工作流：main 的 push CI 成功 → 检出该 SHA → 确认仍为最新 main → 冻结安装依赖 → `pnpm check` → 准备前后端包 → 更新已配置的三个云函数代码 → 验证 API → 发布共享静态托管。dev 和 PR 不发布；手动触发也只允许 main，且必须有该 SHA 对应的成功 push CI。

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

主站使用 CloudBase PG 原生存储 `lycobo-images` 私有桶，不使用旧 NoSQL COS 接口。[追加迁移](../cloudbase/migrations/20261031223300_private_image_storage.sql) 限定单对象 32 MiB、PNG/WebP。原图、兼容 PNG 缩略图、WebP 预览及缩略图保留原对象 key 约定。

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

后端改用 `scripts/cloudbase/deploy-runtime.mjs`：固定 @cloudbase/cloudbase-mcp 2.36.2、MCP SDK 1.32.2、COS SDK 3.0.0，依赖仅安装到 runner 临时目录，不进入应用包或根锁文件。MCP 获取环境自有 COS 桶的上传能力，限制区域、桶、代码前缀和函数名；COS SDK 将代码包按 1 MiB 分块、最多 3 路传输，单请求 90 秒超时、最多三次刷新目标重试，仅输出百分比和脱敏错误码。成功传输后才通过 MCP 提交代码更新。函数恢复 Active 且修改时间变化后，用 COS SDK 删除本次代码对象。管理凭据仅存在于进程内，不输出或写入应用配置。

MCP 安装在登录前的独立步骤完成（5 分钟上限），发布进程直接启动已安装的入口，避免发布时隐式下载。后端跨地域分块传输已有实际进度，步骤上限调整为 20 分钟，整体任务仍为 30 分钟；日志仅记录动作、传输进度和脱敏错误，不包含参数、响应、凭据或上传地址。

本地已用同一两段式入口实际更新三个服务并确认 Active，三个临时代码对象已删除。针对 URL/桶/用途校验、错误脱敏、上传失败重试和代码提交顺序的专项测试通过。新工作流仍需 GitHub 实际运行验证。

GitHub 第三轮发布已确认 MCP 启动和认证成功，但单次 PUT 连续三次在 90 秒超时；随后改为上述分块上传。本地已通过该路径再次更新三个服务，云端变量和定时器保留。GitHub 分块发布结果须以实际 Actions 运行结论为准。

静态托管使用 `tcb hosting deploy .` 的默认根路径。CLI 3.8.11 显式传 `/` 会在一致性校验中保留前导斜杠，误报全部 missing 并回滚；省略该参数后本地 94 文件发布成功，verified=true、failedCount=0。保留 --safe --verify，不通过关闭校验绕过问题。执行目录必须是独立发布目录，不能用 --cwd 代替进程工作目录后仍传 `.`。

GitHub 使用长期 SecretId/SecretKey，不能调用仅支持临时登录态的 MCP `get_temp_credentials`。COS 传输与清理在 CI 直接读取已配置的两个 Environment Secrets；本地 device 授权才走显式临时凭据接口。凭据仅在内存使用，两条路径均由回归覆盖，缺少配对字段时拒绝回退到其他身份。
