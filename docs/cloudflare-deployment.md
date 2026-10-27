# Cloudflare 部署

当前目标架构为 **Pages + Workers API + Queues 消费者 + R2 + Supabase PostgreSQL**。同一个 pnpm workspace 仓库，三个部署入口，不拆仓库，也不使用 Containers、BullMQ 或 Redis。配置与本地测试不代表已经上线；远端资源、订阅、凭据和真实模型验收需分别确认。

## 应用与资源

| 部分 | 仓库入口 | Cloudflare 资源 |
| --- | --- | --- |
| React / Vite | `apps/web` | Pages 项目 `lycobo`，静态输出 `dist` |
| Hono API | `apps/api/cloudflare/index.ts` | Worker `lycobo-api`，不开放 workers.dev |
| 生图与 outbox 恢复 | `apps/worker/cloudflare/index.ts` | Worker `lycobo-generation`，Queues 消费与每分钟 Cron |
| 队列／死信 | `packages/queue` | `lycobo-generation` / `lycobo-generation-dead` |
| 私有图片 | `packages/storage/src/r2-image-store.ts` | R2 bucket `lycobo`，不开公共域名 |
| PostgreSQL | `packages/db` | Supabase 项目 `wjirihknptxjodgknbfy`，经 Hyperdrive 连接 |

Pages 的 `functions/api/[[path]].ts` 用服务绑定将 `/api/*` 转给私有 API Worker，原样保留 Cookie 和 Origin。浏览器保持同域；无 wildcard CORS，不把 JWT、数据库密码或服务商 key 发给前端。Pages 预览域名不自动进入登录白名单；生产 API 仅接受 Cloudflare 中 `AUTH_TRUSTED_ORIGINS` 配置的精确 HTTPS Origin。

API／消费者复用原有 Hono 路由、账号哈希、Drizzle schema 和 PostgreSQL repository。Workers 连接按请求／消息批次创建、结束后关闭；Hyperdrive 管理源站连接池，**必须关闭查询缓存**，避免缓存身份撤销、余额和任务状态。Postgres.js 保持 prepared statements；每个 repository 的边缘连接上限为 1，不建立跨请求全局客户端。数据库迁移仍显式运行 `pnpm db:migrate:supabase`，部署不执行 `db push`、不重建表。

## 任务可靠性

1. 任务、图片项、扣费和 outbox 在一个 PostgreSQL 事务中提交。
2. API 返回任务后，仅在 `waitUntil` 中投递消息；不在 HTTP 后台调用付费模型。投递失败保留 outbox，由每分钟 Cron 恢复。
3. Queues 消息只含 `{version:1,itemId}`。发送成功后才确认对应 outbox lease；发送与确认之间中断可能重复投递，数据库 claim／执行令牌阻止重复付费调用。
4. 消费批次为 1，全队列最大并发 2。完成结果、确定失败退款、未知结果待核对均沿用原有数据库事务。网络超时或供应商结果不明确，不自动再次提交模型。
5. 传输失败最多重试 3 次后进入死信队列。死信不是账务真相，排查以 PostgreSQL 为准；不能清理账本或将 running 强行改回 queued。过期 claim 由 Cron 标为需核对，用户明确确认后的重试继续使用既有原子退款／新扣费流程。

Cron 每轮最多投递 100 条待执行意图；正常提交会即时触发投递。故障恢复后若有大量积压，需观察 outbox 与队列吞吐，不能把“部署成功”当作“所有任务已完成”。

## 按 UID 分目录的私有图片

新图片 object key 为：

```text
0057849613/<organization-uuid>/<asset-uuid>.png
0057849613/<organization-uuid>/<asset-uuid>.thumbnail.png
```

第一层是服务端从 `users.uid` 解析的固定 10 位 UID，保留前导 0；第二层区分工作空间。参考图、生成结果使用同一规则，缩略图按需创建并保存在 R2。调用者不能传 UID 或存储 key 决定归属，读取前仍由数据库校验组织和成员身份；同一企业现有的共享素材权限保持不变，目录隔离不替代授权。

R2 使用 Workers 原生绑定，不需要前端凭据或 S3 Access Key。图片经过校验、去元数据并规范化为 PNG；不直接保存 SVG 或动画图。文件大小、像素上限沿用现有契约。Cloudflare Images binding 替代不兼容 Workers 的原生 `sharp`，原件和缩略图都存 R2，不购买 Images 托管存储。

Images 转换是额外计量项：Free 每月最多 5,000 次唯一转换，超过后新转换失败，不会自动升级；Paid 超额为 $0.50/1,000 次。校验中的 `.info()` 免费。上传规范化和缩略图可能分别计数；服务端图片处理失败不会伪造成功。价格与额度以 [Images 官方定价](https://developers.cloudflare.com/images/pricing/) 为准。

旧本地文件不会因切换存储自动上传。数据库里已有的旧文件 key 不重写，不提供“找不到 R2 就读其他用户文件”的回退；有旧数据时需单独核对文件及数据库记录后迁移。

## 首次配置与部署

仓库固定使用当前确认的 `lycobo` 账户 `9a65fad90669d9c27b58d856ab3ce410`，不操作其他账户、bonko 项目或已有不相关资源。

1. 首次部署使用 Workers Free，不设置付费计划专用 CPU 上限，不升级订阅。HTTP 请求 CPU 上限为 10ms，网络等待不计 CPU；需要在真实免费运行时实测 scrypt 登录与上传。若发生 CPU 超限，记录失败并讨论优化，不降低密码校验强度、不自动升级。R2 保持当前已启用状态。当前 Chrome 已确认存在私有的 `lycobo` bucket（Public Access Disabled），配置复用该桶，不另建同用途桶。R2 即使额度内为 $0，也需用户确认订阅与条款；脚本不会开通或升级套餐。
2. 通过 Cloudflare 创建仅限此账户的 API token，权限覆盖 Workers Scripts、Queues、R2 Storage、Hyperdrive、Pages 的编辑，以及 Cloudflare 要求的账户读取权限。令牌只填被忽略的根 `.env` 的 `CLOUDFLARE_API_TOKEN`，不发到聊天或提交 Git。创建访问凭据／同意订阅由用户完成。
3. 首次创建 Hyperdrive／显式迁移时，`SUPABASE_DATABASE_URL` 只在本地受保护的 `.env` 使用；日常部署不读取数据库密码。生产运行变量和 Secrets 只在 Cloudflare 管理，具体位置见下表。本地开发使用独立凭据。
4. `pnpm cloudflare:setup` 创建或复用上述私有 bucket、两条队列、Hyperdrive 与 Pages 项目；Hyperdrive 关闭缓存并使用 require TLS（Cloudflare WebPKI 验证服务器证书），资源 ID 保存到 `.env` 的 `CLOUDFLARE_HYPERDRIVE_ID`。脚本不修改密码／套餐，不删除资源，失败后先检查同名资源再重跑。
5. 在 Cloudflare 的 `lycobo-api` 中配置 `AUTH_TRUSTED_ORIGINS` 为实际 Pages HTTPS Origin 或已绑定的自定义域名。Pages 项目名对应的域名若有后缀，以控制台实际结果为准。
6. `pnpm cloudflare:deploy --plan` 检查目标与本地参数；`pnpm cloudflare:deploy` 先检查 Hyperdrive 目标和缓存，再构建前端，依次发布消费者、API 和 Pages。

部署脚本只生成资源配置，不读取或上传运行 Secrets；两个 Worker 均使用 `keep_vars: true`，发布配置不含 `vars`，保留 Cloudflare 已有运行变量和 Secrets。部署前读取两个 Worker 的运行配置摘要；每个 Worker 部署后核对普通变量值及 Secret 名称／类型，若不一致立即失败并停止后续步骤。Secret 原值不可读，不比较也不输出；普通变量值仅用于内存中的摘要计算，不写入文件或日志。新 Worker 没有历史配置时会明确提示需要在 Cloudflare 配置。资源绑定、队列消费者和 Cron 仍由仓库管理。构建失败或账户配置缺失会返回非零；脚本不自动推送 Git，不合并分支，不执行付费生图，不宣称已通过外部集成。

三个部署配置保留同一仓库；修改共享契约时先兼容消费者和 API，再发布 Pages。GitHub Actions 在 `main` 推送且对应 CI（含远程 E2E 和隔离集成）全部成功后自动发布；使用 CI 的精确提交 SHA，拒绝已被新提交取代的旧版本。也可仅从 `main` 手动触发。生产发布不依赖本地机器上的 Redis、文件目录或 Docker。

## GitHub 自动部署配置

仓库为 `PixelMerch/lycobo`，部署使用 `cloudflare-production` Environment，仅允许 `main`。不同时开启 Cloudflare 原生 Git 构建，以免和 Actions 重复部署。

GitHub Environment 仅保留：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 发布 Workers／Pages，读取 Hyperdrive 配置 |
| Variable | `CLOUDFLARE_HYPERDRIVE_ID` | 将两个 Worker 绑定到已存在的 Hyperdrive |

`CLOUDFLARE_ACCOUNT_ID` 与 `SUPABASE_PROJECT_REF` 是非敏感部署目标标识，固定在工作流中。部署预检根据项目标识核对 Hyperdrive 目标主机及查询缓存关闭状态，不再需要数据库密码。数据库凭据由 Cloudflare Hyperdrive 资源管理，Worker 使用 `HYPERDRIVE.connectionString`。

生产运行配置在 Cloudflare → Workers & Pages → 对应 Worker → Settings 中管理：

| Worker | 类型 | 名称与配置 |
| --- | --- | --- |
| `lycobo-api` | Secret | `AUTH_JWT_SECRET`：至少 32 字节，保留已有值以免已有登录令牌失效 |
| `lycobo-api` | Variable | `APP_ENV=production`；`AUTH_TRUSTED_ORIGINS=https://lycobo.pages.dev`（按实际域名调整） |
| 两个 Worker | Variable | `IMAGE_GENERATION_ENABLED`、`VAKV_ENABLE_IMAGE_EDITS`：分别配置，保持一致；未验收时为 `false` |
| `lycobo-generation` | Secret | `VAKV_API_KEY`：启用真实生图时必需 |
| `lycobo-generation` | Secret | `MODEL_CREDENTIAL_SECRET`：生产独立的32字节Base64主密钥，解密数据库中的渠道Key，不进入GitHub Actions或前端 |
| `lycobo-generation` | Variable | `VAKV_BASE_URL=https://api.ai-media.vip`；`GENERATION_TIMEOUT_MS=600000` |

不要把这些运行配置放到 Pages 静态前端或 `VITE_*` 中。首次部署新 Worker 后，必须在 Cloudflare 补齐运行配置才能验收；部署成功不代表运行配置齐全。后续自动、手动、本地脚本部署均保留 Cloudflare 的运行值，手动部署不再提供生图开关。`keep_vars` 仅保留运行变量，资源绑定仍随仓库配置发布。[Wrangler 官方说明](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)。

从旧工作流迁移：

1. 先核对 Cloudflare 两个 Worker 的上述配置完整，尤其是消费者的 `VAKV_API_KEY`；不需要更换 JWT 或模型密钥。
2. 发布使用新版工作流的代码（推送、合并与部署仍需单独授权）。旧 main 工作流仍依赖 GitHub 中的旧值，不能提前删除。
3. 新版工作流生效后，从 GitHub `cloudflare-production` 删除 Secrets `AUTH_JWT_SECRET`、`VAKV_API_KEY`、`SUPABASE_DATABASE_URL`，以及 Variables `CLOUDFLARE_PUBLIC_ORIGIN`、`IMAGE_GENERATION_ENABLED`、`VAKV_ENABLE_IMAGE_EDITS`。不要删除 Cloudflare 中的运行值。
4. 本地 `.env` 中生产运行密钥可在确认独立开发凭据后移除；数据库直连密码仅在资源初始化／显式迁移时使用，不进入 Actions。

GitHub 不支持读取已保存的 Secret 原值。令牌只放入 GitHub Secret 或被 Git 忽略的本地 `.env`，不得放入文档、工作流或聊天。

## 本地开发与验证

```sh
pnpm install --frozen-lockfile
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

`pnpm dev` 先写入被忽略的 `.dev.vars`，然后启动 Vite 5173 与多 Worker Wrangler 8787。本地 Hyperdrive 配置明确指向本项目 loopback PostgreSQL；Queues、R2 和 Images 使用本地模拟，持久状态保存在被忽略的 `.wrangler/state`，不会写远端 R2。根 `DATABASE_URL` 可继续用于显式的 Supabase 管理操作，不会成为本地模拟的隐藏回退。

本地生成默认关闭；需要真实开发调用时，显式设置 `LOCAL_IMAGE_GENERATION_ENABLED=true` 并提供 provider key，且该本地数据库须有真实授权的账号和余额。不要用 fixture 账号／积分说明线上可用。`apps/api` 的 `dev:node` 仅用于 Node 调试，独立 Node API 不提供新的队列运行时，不作为生产部署入口。

```sh
pnpm check
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

检查包括：两个 Worker 的 Wrangler dry run、Pages Functions 类型、队列发送失败不确认、数据库确认失败可恢复、无效消息不触发付费处理，以及隔离 PostgreSQL 中原有的并发扣费、退款、租约、幂等与鉴权。`pnpm test:cloudflare` 单独验证真实本地 workerd 的 Queues/R2/Images；设置上述隔离测试变量后，还执行完整原生 API／消费者链路，模型使用本地 fixture，无付费请求。

## 上线验收

必须记录实际部署 URL／版本、登录及刷新／退出、上传与 UID 路径、缩略图、跨组织拒绝、历史与钱包读取。真实生图测试需要明确账号和消费限额，不因脚本退出码为 0 自动调用模型。消费者、API 或 Pages 任一步失败，都不能对用户报告整体已上线。

SSE 在 Workers 中保持原有持久事件游标、组织隔离、身份复验及断线恢复，通过每 3 秒查询事件日志代替长驻 `LISTEN`。Node 测试仍验证原有 NOTIFY 事务语义；边缘平台不依赖进程常驻或 Redis 转发。

参考：[Workers Postgres.js / Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/)、[Queues 限制](https://developers.cloudflare.com/queues/platform/limits/)、[Images binding](https://developers.cloudflare.com/images/optimization/binding/)、[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。

## 2026-10-23 首次部署记录

使用 Workers Free 完成消费者、API、Pages 部署，入口 https://lycobo.pages.dev。线上首页与 `/api/health/live` 返回 200；已有企业账号登录返回 code 0 并设置登录 Cookie。令牌与资源变量已同步到 GitHub cloudflare-production，本地 .env 保留。生成默认关闭；真实生图与线上上传验收尚未执行。

## 运行配置管理调整

部署代码改为保留 Cloudflare 运行变量及 Secrets；GitHub 只传部署令牌与资源标识。此代码调整不代表已经发布或已删除 GitHub 的历史配置，需按上述迁移顺序完成。

## 私有图片资源 Worker

`lycobo-assets` 单独绑定私有 R2 `lycobo`，不连接数据库、不执行生图。新图在上传／生成时预先保存原始 PNG、兼容 PNG 缩略图及 WebP 展示版本，全部完成后才暴露素材；派生图失败时保留原图供核对，不自动重调模型。资源 Worker 绑定 Images，仅在历史图片缺少 WebP 版本时补生成并持久保存；这会使用 Images 处理额度，后续复用缓存／对象。API 在鉴权后批量返回 30 分钟签名链接；旧 content 接口兼容为重定向，启用后不再传输图片。上传响应也直接返回签名链接，避免新上传图片的首次预览经过 content 兼容入口。前端过期图片加载失败时按需刷新链接，不恢复定时轮询。

运行配置仅在 Cloudflare 管理：API 配置 Secret `ASSET_SIGNING_SECRET` 与 运行配置 `ASSET_PUBLIC_ORIGIN`；资源 Worker 配置相同 Secret 与 运行配置 `ASSET_ALLOWED_ORIGINS=https://lycobo.pages.dev`（逗号分隔精确 Origin）。域名切换时同步更新资源 Origin、CORS 与 Referer 白名单。两个非敏感配置也可用 Cloudflare Secret 保存，以便仅更新指定 binding 并保留其他配置。不要使用 JWT 密钥作为图片签名密钥，不在 GitHub 保存这些运行配置。

资源 Worker 验证对象路径、签名和过期时间，再读取边缘缓存；缓存键仅含对象路径与展示版本，不含签名。未命中时直接返回 R2 body 流。缓存内部可复用对象，浏览器收到 private 且不超过签名剩余寿命的缓存时间。下载使用 attachment；跨域图片使用 anonymous CORS，Referer 精确匹配白名单，每次请求必须至少携带一个受信任的 Origin 或 Referer，缺失来源也拒绝；任何存在的来源头都必须精确匹配。HMAC v2 绑定对象 key、到期时间和 preview／thumbnail／download 用途，预览签名不能通过修改参数换取原图。下载拒绝 Sec-Fetch-Dest=image，只返回 attachment，浏览器响应使用 private,no-store。预览／缩略图响应 Vary 包含 Origin、Referer 和 Sec-Fetch-Dest，防止浏览器缓存绕过来源／用途检查。来源校验与签名共同工作；来源头本身不是身份凭据。日志隐藏 query string，禁止记录签名链接。

发布时先部署资源 Worker、配置 Cloudflare 密钥，再启用 API 的资源 Origin。R2 不打开公共域名或 r2.dev。默认 workers.dev 可验证验签、流式访问与缓存，生产仍建议绑定自定义域名并重新验收。2026-10-23 候选入口实测：30 次请求中 24 次正常读取、6 次无效／越权请求均拒绝，22 次缓存命中、2 次未命中；Cloudflare CPU 中位数 1.031ms、P99 2.805ms，执行错误 0。该结果是本次取样，不能代替后续域名、网络与负载下的验收。本地 workerd 同时验证缓存与拒绝访问行为。默认 `url` 返回 `variant=preview`：最长边 1600px、WebP quality 82；缩略图为 `variant=thumbnail`：最长边 512px、WebP quality 76；仅 `variant=download` 返回原始 PNG 并使用 attachment。展示路径使用 `.preview.webp`／`.thumbnail.webp`，而非原图的 `.png` 路径。禁止把缺失展示版本回退成原图响应。参考图编辑的服务端输入仍使用原始文件，前端选区坐标以原始宽高计算。首次启用需先发布带 Images binding 和新变体支持的资源 Worker，再发布生成新链接的 API；已有旧链接不带 variant 时也按预览版本处理。

签名升级到 v2 后，旧签名链接将被拒绝；需要协调更新资源 Worker 和 API，并让客户端刷新元数据。旧链接不会被降级放行以换取原图。此代码变更不代表已部署线上。

## v0.3.0 发布配置

GitHub `cloudflare-production` 仅保留部署用 `CLOUDFLARE_API_TOKEN` 和非敏感 `CLOUDFLARE_HYPERDRIVE_ID`，不保存模型Key、JWT主密钥或数据库密码。运行密钥在 Cloudflare 对应 Worker 的 Settings 管理，部署保留其值。可配置渠道的供应商Key加密保存在 PostgreSQL，解密主密钥仅放消费者 Cloudflare Secret；新增中转站通过模型服务后台配置，无需改GitHub Actions。生产主密钥与本地开发独立，被忽略的本地生产配置备份须设为仅当前用户可读，不得提交。

本次上线须先将Supabase迁移到0025（独立管理员／模型渠道／菜单／历史归档），再部署Workers与Pages。迁移仅扩展结构，不导入本地账户、积分、图片或生成记录。新渠道沿用本地已验证的FluxPort异步协议；公网验收只检查登录、能力和历史读取，不自动发起付费生成。
