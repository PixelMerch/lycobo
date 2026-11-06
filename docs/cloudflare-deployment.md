# Cloudflare Workers 运行与部署

更新：2026-11-06。生产统一使用 Cloudflare Workers、Queues、Durable Objects、Images 和私有 R2。现有新加坡 PostgreSQL 经 Hyperdrive 访问。图片生成、DeepSeek 提示词优化与规划已按用户授权开启，视频关闭。

## 运行单元

| Worker          | 入口与职责                                                                         | 公开入口                         |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `lycobo`        | `apps/api/src/cloudflare.ts`；Static Assets、Hono API、签名媒体和 `RealtimeHub` DO | `lycobo.com`、`media.lycobo.com` |
| `lycobo-images` | `apps/worker/src/cloudflare.ts`；图片 Queue、上传处理、变体与每分钟恢复 Cron       | 无公开 HTTP 入口                 |

两个 Worker 分别配置于 `wrangler.jsonc` 和 `wrangler.images.jsonc`，可以独立部署与回滚。图片消费者通过 `REALTIME` 跨 Worker 绑定访问主站命名空间，不能把图片处理放回主站请求内。

Hyperdrive 目标为新加坡 `aws-0-ap-southeast-1.pooler.supabase.com:5432`，项目 `uyfgzmqijdsesnlsiwqu`。两个 Worker 使用 `aws:ap-southeast-1` placement，业务查询关闭 Hyperdrive 缓存。每次调用创建并关闭自己的数据库客户端；提示词优化 SSE 在流结束、错误或取消后关闭连接，不因 HTTP 响应已返回而提前关闭。

Node API、Sharp、S3 与 LISTEN/SSE 仅用于隔离本地开发及测试。生产任务状态使用 [可休眠 WebSocket](realtime.md)，正常在线不定时查询任务 API。

## 图片处理

上传文件先暂存私有 R2，并保存恢复意图，再发送 Queue。图片 Worker 校验输入，使用 Images binding 解码、清理元信息、规范化 PNG，并生成 WebP 预览与缩略图，最后登记 PostgreSQL 素材。重复消息使用稳定素材 ID 和内容哈希，回执丢失不会生成另一份素材。

原始桶保持私有，禁止 r2.dev 或其他入口直接公开。`/images/*` 经主站 Worker 校验短期签名、用途、来源与过期时间后读取 R2，缺失派生变体通过 Queue 补齐。付费输出不套用浏览器参考图压缩规则。无透明通道的供应商参考图可以压缩为 JPEG，透明图保留 PNG。

上传的有限时长回执确认仍属于上传操作自身；已创建的生图任务不启用浏览器定时轮询。视频提交、视频队列与 MP4 媒体入口在当前 Workers 中保持关闭。

## 任务、回调与付费开关

任务、扣费和 outbox 在同一个 PostgreSQL 事务中提交。API 只投递已持久化的意图，独立消费者受租约、执行令牌和幂等约束保护；有歧义的供应商提交不能自动重投。

`CLOUDFLARE_TASKS_SINCE=2026-11-06T02:05:11.556Z` 是固定接管时间，部署不能重置。任务认领、超时处理和恢复都保持该边界，防止旧执行被重新计费。当前两个 Worker 的 `CLOUDFLARE_GENERATION_ENABLED`、`CLOUDFLARE_CONSUMER_ENABLED` 与 `IMAGE_WEBHOOK_ENABLED` 均为 `true`。

生图 Key 使用独立的 `lycobo-cloudflare`。Webhook 接收地址为 `https://lycobo.com/api/v1/webhooks/fluxport/images`，按原始请求体做 HMAC 签名与时间窗口校验。没有回调的中转站通过延迟消息查询原任务，不依赖浏览器保持在线，详见 [图片回调](image-webhooks.md)。

提示词优化与规划同样受生成开关约束。检查、构建、部署、健康探测和签名拒绝测试均不需要调用真实付费模型；真实生成由用户按明确额度测试。

## 绑定与 Secrets

| 项目               | 当前资源                                                 |
| ------------------ | -------------------------------------------------------- |
| Cloudflare Account | `9a65fad90669d9c27b58d856ab3ce410`                       |
| Hyperdrive         | `7ce66ede4e634fab8dc16240a6cedb6c`                       |
| R2                 | `lycobo-media-prod`，私有                                |
| 图片 Queue         | `lycobo-images`，独立消费者 `lycobo-images`              |
| 死信 Queue         | `lycobo-images-dead`                                     |
| SQLite DO          | `lycobo_RealtimeHub`，`631c155e20c2425ab2926cba7c790813` |
| 主站资产           | `apps/web/dist`；业务密钥不能进入 `VITE_*`               |

主站需要 `AUTH_JWT_SECRET`、`ASSET_SIGNING_SECRET`、`STANDALONE_IMAGE_API_KEY`、`DEEPSEEK_API_KEY`、`IMAGE_WEBHOOK_SECRET`。图片 Worker 只需要媒体签名与两个模型密钥。普通变量、域名、Queue 和绑定以两个 Wrangler 配置为准。

Secrets 使用受保护输入或忽略的临时文件配置；不能写入 Git、命令参数、日志或前端。`backups/`、`.env*`、`.dev.vars*`、`.cloudflare/` 保持 Git 忽略，只有 `.env.example` 可提交。不得依赖开发进程自动继承生产基础设施凭据。

## 发布顺序

1. 按 AGENTS.md 核对目标账号、Worker、Git 版本、迁移和用户授权；`pnpm check` 与隔离验证通过后再发布。
2. 有表结构变化时，先执行经审查的 PostgreSQL 追加迁移；应用不会自动 db push。
3. `pnpm cf:types` 生成绑定类型，`pnpm build` 构建前端并分别 dry run 两个 Worker。
4. 初次创建 DO 或修改跨 Worker 绑定时，先部署主站，再部署图片 Worker；仅修改前端时可只部署主站。凭据必须显式加载并校验目标。
5. 使用 `pnpm cf:check:config` 同时比较控制台设置和 100% 活动版本。控制台保存的草稿不等于当前正在处理请求的版本。
6. 验证首页、API、私有媒体拒绝与 WebSocket，再根据实际产品变化发布 `release.json` 公告。日志或配置修复不重复公告。

构建或 dry run 通过只说明制品可生成，不代表线上资源和模型可用。具体回放、消息、版本公告及隔离运行时测试见 [实时推送](realtime.md)。

## 已核对的线上记录

2026-11-06：请求去重实现 `de678015` 已推送 dev 并部署，主站版本 `b73b9580-7e11-49f1-b2c3-5a986f5a52aa`；图片 Worker 版本 `6d739b49-dd2c-4993-b0ee-327902910ef9`。两者均为 100% 活动版本，控制台变量与 Secret 类型检查无差异。两个 `REALTIME` 绑定指向同一个 SQLite 命名空间。

数据库已应用 `0043_realtime_push`，共 44 项迁移，51 张业务表维持 RLS 与前端角色限制。发布摘要 `2026.11.06-realtime.1` 已实际经 PostgreSQL outbox → 图片 Worker Cron → DO → 浏览器到达，WebSocket 握手、ready 和自动 pong 均已验证。

后续本地清理提交不自动改变上面的部署记录；远端实际版本以 Cloudflare Deployments 和配置检查结果为准。
