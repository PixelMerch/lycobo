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

Pages 的 `functions/api/[[path]].ts` 用服务绑定将 `/api/*` 转给私有 API Worker，原样保留 Cookie 和 Origin。浏览器保持同域；无 wildcard CORS，不把 JWT、数据库密码或服务商 key 发给前端。Pages 预览域名不自动进入登录白名单；生产绑定仅接受 `.env` 中配置的精确 HTTPS Origin。

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
3. 保持 `SUPABASE_DATABASE_URL` 的真实密码只在 `.env`；提供至少 32 字节的 `AUTH_JWT_SECRET`。真实生成还需 `VAKV_API_KEY`，以及已验证的能力开关。
4. `pnpm cloudflare:setup` 创建或复用上述私有 bucket、两条队列、Hyperdrive 与 Pages 项目；Hyperdrive 关闭缓存并使用 require TLS（Cloudflare WebPKI 验证服务器证书），资源 ID 保存到 `.env` 的 `CLOUDFLARE_HYPERDRIVE_ID`。脚本不修改密码／套餐，不删除资源，失败后先检查同名资源再重跑。
5. 核对 `CLOUDFLARE_PUBLIC_ORIGIN` 为实际 Pages HTTPS 域名或已经绑定的自定义域名。Pages 项目名对应的域名若有后缀，以控制台实际结果为准。
6. `pnpm cloudflare:deploy --plan` 检查目标与本地参数；`pnpm cloudflare:deploy` 先检查 Hyperdrive 目标和缓存，再构建前端，依次发布消费者、API 和 Pages。

部署脚本通过受限临时文件上传 Worker Secrets，结束后删除文件，不把秘密放进命令参数、配置 vars、构建产物或控制台。构建失败或账户配置缺失会返回非零；脚本不自动推送 Git，不合并分支，不执行付费生图，不宣称已通过外部集成。

三个部署配置保留同一仓库；修改共享契约时先兼容消费者和 API，再发布 Pages。GitHub Actions 在 `main` 推送且对应 CI（含远程 E2E 和隔离集成）全部成功后自动发布；使用 CI 的精确提交 SHA，拒绝已被新提交取代的旧版本。也可仅从 `main` 手动触发。生产发布不依赖本地机器上的 Redis、文件目录或 Docker。

## GitHub 自动部署配置

仓库为 `PixelMerch/lycobo`，部署使用 `cloudflare-production` Environment，仅允许 `main`。不同时开启 Cloudflare 原生 Git 构建，以免和 Actions 重复部署。生产环境所需 Secrets：`CLOUDFLARE_API_TOKEN`、`SUPABASE_DATABASE_URL`、`AUTH_JWT_SECRET`，生成启用时增加 `VAKV_API_KEY`。Variables：`CLOUDFLARE_HYPERDRIVE_ID`、`CLOUDFLARE_PUBLIC_ORIGIN`、`IMAGE_GENERATION_ENABLED`、`VAKV_ENABLE_IMAGE_EDITS`。生成开关缺省为 false。

Secrets 的原始值保留在被 Git 忽略、权限为 0600 的本地根 `.env`，不得放入文档、工作流或聊天；GitHub 不支持读取已保存的 Secret 原值。部署环境必须配置完成后再发布，缺失令牌或资源 ID 会明确失败，不报告上线成功。

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
