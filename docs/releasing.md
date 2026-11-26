# 发布与部署

dev 合并到 main 后先运行 CI。通过 GitHub Actions 的 Release 工作流发布正式版本后，自动部署该标签对应的提交到 Cloudflare。生产数据库迁移仍需单独确认和执行。

## 合并

日常开发直接在本地 dev 进行，先 fetch 并在可快进时同步 origin/dev，保留本地工作；只有用户要求时才创建短分支。完成验证后默认只做本地提交。
用户明确要求推送、PR 或合并后再执行；临时功能分支向 dev 提 PR，发布集成由 dev 向 main 提 PR，填写模板，运行 pnpm check；浏览器回归仅在 GitHub Actions 手动执行。
main 为稳定分支，只有用户明确要求发布集成时才由 dev 向 main 提 PR。
契约/数据库/计费变更安排领域审查；合并前同步目标分支，不覆盖其他作者的迁移。
PR 标题采用 Conventional Commits，合并前必须等 CI 通过并满足目标分支保护。
dev 到 main 使用 merge commit 保留提交祖先关系；普通功能 PR 可使用 squash。
dev 合并到 main 后，本地和远程都必须保留 main、dev，不使用 --delete-branch 删除 dev。同步对应本地分支后回到 dev 继续开发。
分支清理始终排除 main、dev；用户要求清理时，只有确认已合入或已被替代的临时分支才可删除，不删除未核实合入的独立工作。

Dependabot 的 npm 与 GitHub Actions 常规版本升级统一向 dev 提 PR，保留原有周期与分组。目标为 dev 的依赖 PR 做冒烟验证，推送 dev 后及发布集成的 dev → main PR 运行 Quality 与 Infrastructure 检查，浏览器回归仅在 GitHub Actions 手动运行，具体规则见 [测试说明](testing.md)。
Dependabot 从默认分支读取 `.github/dependabot.yml`，因此该配置推送到 dev 后，要在下一次获授权的 main 集成完成后才会正式生效。GitHub 的安全更新仍面向默认分支，不受 `target-branch` 控制；此类 PR 继续执行 main 的完整验证。

## 版本与构建

采用 SemVer。破坏契约/数据兼容性需要迁移方案；不能仅增加版本号。
版本由根 package.json 标记，应用的 private workspace 版本不代表独立对外 SDK。
发布使用固定 Node/pnpm 和 frozen lockfile，关联提交 SHA、构建产物和迁移。
已发布 tag 不移动、不覆盖；发布说明说明用户行为、修复、迁移和已知限制。

## 部署顺序

1. 评估 expand/contract，手动应用经审查的 `packages/db/migrations/` 追加迁移；迁移必须兼容正在运行的代码。
2. main 的 CI 通过后，运行 Release 工作流。GitHub Release 发布成功后，先部署主站 Worker，再部署独立图片 Worker。运行与验收见 [Cloudflare 运行与部署](#cloudflare-运行与部署)。若变更依赖新消费者支持契约，按对应业务章节的兼容顺序发布。
3. 验证健康、真实读写和错误率。
4. 稳定后才清理旧字段/契约。

## 回滚

代码回滚使用已验证产物；数据库迁移不能默认反向执行。
计费/上传/模型请求等外部副作用需要业务对账，不随代码回滚自动消失。
发布记录保留实际执行人、版本、目标环境、验证与回滚点。

## GitHub Release 与自动日志

从 2026-11-06 起，`.github/workflows/release.yml` 仅保留 `workflow_dispatch`。合并、推送 main、CI 完成或推送 tag 均不自动创建 GitHub Release；已删除自动分配补丁版本的脚本。版本号由发布人明确填写，不修改已有标签或额外回写版本提交。

手动入口：在 GitHub Actions 的 **Release → Run workflow** 选择 `main` 并填写 `vX.Y.Z`。目标提交必须属于 main 历史且对应 main push CI 成功。发布会生成标签、更新日志、作者与文件变更附件；浏览器端到端回归在独立的 CI 手动入口运行。

Release 工作流发布成功后调用 `deploy-cloudflare.yml`。部署 job 核对最新正式版本的标签与构建提交，串行部署两个 Worker，检查活动配置与主站健康。部署失败可在原 Release 运行中选择 **Re-run failed jobs**。如果需要先修复工作流，合入 main 后可在 **Deploy Cloudflare → Run workflow** 选择 main 并输入最新正式版本号，重新部署原标签。通过 GitHub Releases 页面直接发布的版本不会自动部署。产品公告在部署成功后由 `release.json` 与发布脚本写入，见 [实时推送](realtime.md)。

自动说明由 `scripts/release-notes.mjs` 从真实 Git 历史生成：

- 按功能、修复、性能、重构、文档、自动化和测试分类，列出提交标题及链接。
- 记录作者、与作者不同的提交人和 GitHub 用户链接，不公开作者邮箱。
- 显示每个提交涉及的文件及版本比较链接；首次发布包含完整仓库历史。
- 后续版本以上一个当前提交可达的正式版本 tag 为基线；未合入分支上的 tag 不参与比较。
- Release 正文最多列最近150个提交，过长时进一步缩短；附件 `CHANGELOG.md` 和
  `changes.json` 保存完整日志和全部逐提交文件列表，避免正文长度上限导致记录丢失。

工作流使用固定 SHA 的官方 Actions，只有发布 job 获得 `contents: write` 和 `actions: read`；
无需另建 PAT，不执行来自 PR 的发布逻辑，不把输入拼进 shell 程序。已发布版本不覆盖，
重复触发同一已发布版本会跳过创建步骤。若创建成功但附件上传失败，先核对现有 Release 再修复缺失附件，
不要删除或移动已发布 tag。工作流运行页保留执行人、目标提交和日志。

本地可在不访问 GitHub、不创建 tag／Release 的情况下预览（输出不要提交）：

```sh
node scripts/release-notes.mjs --version v0.1.0 --offline --output /tmp/lycobo-release-preview
```

离线预览使用 Git 中的作者／提交人姓名；正式工作流通过 GitHub API 补齐账号归属。
测试覆盖首版完整历史、后续版本范围、未合入 tag、合并文件变更、作者归属、Markdown转义和API失败。

## Cloudflare 运行与部署

### 运行单元

| Worker          | 入口与职责                                                                         | 公开入口                         |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `lycobo`        | `apps/api/src/cloudflare.ts`；Static Assets、Hono API、签名媒体和 `RealtimeHub` DO | `lycobo.com`、`media.lycobo.com` |
| `lycobo-images` | `apps/worker/src/cloudflare.ts`；图片 Queue、上传处理、变体与每分钟恢复 Cron       | 无公开 HTTP 入口                 |

两个 Worker 分别配置于 `wrangler.jsonc` 和 `wrangler.images.jsonc`，可以独立部署与回滚。图片消费者通过 `REALTIME` 跨 Worker 绑定访问主站命名空间，不能把图片处理放回主站请求内。

Hyperdrive 目标为新加坡 `aws-0-ap-southeast-1.pooler.supabase.com:5432`，项目 `uyfgzmqijdsesnlsiwqu`。两个 Worker 使用 `aws:ap-southeast-1` placement，业务查询关闭 Hyperdrive 缓存。每次调用创建并关闭自己的数据库客户端；提示词优化 SSE 在流结束、错误或取消后关闭连接，不因 HTTP 响应已返回而提前关闭。

Node API、Sharp、S3 与 LISTEN/SSE 仅用于隔离本地开发及测试。生产任务状态使用 [可休眠 WebSocket](realtime.md)，正常在线不定时查询任务 API。

### 图片处理

公开产品插图、登录配图、工具封面、模型 Logo 与灵感示例使用独立 R2 桶 `lycobo-site-assets`，经 `static.lycobo.com` 读取。对象以版本目录发布并启用长期缓存，更换图片时先上传新版本、验证 URL，再更新引用。浏览器上传测试的素材保留在测试 fixture。用户上传和生成的图片继续由私有媒体路径处理。

上传文件先暂存私有 R2，并保存恢复意图，再发送 Queue。图片 Worker 校验输入，使用 Images binding 解码、清理元信息、规范化 PNG，并生成 WebP 预览与缩略图，最后登记 PostgreSQL 素材。重复消息使用稳定素材 ID 和内容哈希，回执丢失不会生成另一份素材。恢复扫描使用 R2 列表的状态和到期元数据跳过已完成且未到期的回执，待处理、到期和旧回执仍检查正文。

原始桶保持私有，禁止 r2.dev 或其他入口直接公开。`/images/*` 经主站 Worker 校验短期签名、用途、来源与过期时间后读取 R2，缺失派生变体通过 Queue 补齐。原图存在且成功投递补齐消息后，短期边缘缓存标记可合并同一素材的后续补齐请求。已有原图时，经同一预览鉴权回退私有原图，回退响应不进入变体缓存。付费输出不套用浏览器参考图压缩规则。源图保存与规范化并行，原图与展示变体最多三路并行。可直接保存的 PNG 复用已验证的尺寸，宽高都在 512 像素以内的原图只转换一次 WebP 供两个展示档位使用；Queue 补齐变体时同样复用，只写缺失对象，重复消息发现两个档位都已存在时不读取或转码原图。原图持久化并登记后可交付，展示变体或暂存副本清理失败不阻止交付。原图处理或写入失败时保留暂存源图供恢复。无透明通道的供应商参考图可以压缩为 JPEG，透明图保留 PNG。

上传的有限时长回执确认仍属于上传操作自身；已创建的生图任务不启用浏览器定时轮询。视频提交、视频队列与 MP4 媒体入口在当前 Workers 中保持关闭。

### 任务、回调与付费开关

任务、扣费和 outbox 在同一个 PostgreSQL 事务中提交。API 只投递已持久化的意图，独立消费者受租约、执行令牌和幂等约束保护；有歧义的供应商提交不能自动重投。

图片队列每个消费者调用处理一条消息，Cloudflare 按积压自动扩展，全队列最多 10 个调用并行。异步供应商接单后释放消费者，由延迟消息或回调继续读取原任务；供应商内部的异步执行可能重叠。首次投递失败仍由 outbox 租约恢复。已确认入队且仍在排队的项优先由 Queue 处理，outbox 在原到期时间后额外等待 5 分钟再补投。供应商结果查询和回调唤醒沿用原到期时间。

`CLOUDFLARE_TASKS_SINCE=2026-11-06T02:05:11.556Z` 是固定接管时间，部署不能重置。任务认领、超时处理和恢复都保持该边界，防止旧执行被重新计费。当前两个 Worker 的 `CLOUDFLARE_GENERATION_ENABLED`、`CLOUDFLARE_CONSUMER_ENABLED` 与 `IMAGE_WEBHOOK_ENABLED` 均为 `true`。

生图 Key 使用独立的 `lycobo-cloudflare`。Webhook 接收地址为 `https://lycobo.com/api/v1/webhooks/fluxport/images`，按原始请求体做 HMAC 签名与时间窗口校验。没有回调的中转站通过延迟消息查询原任务，不依赖浏览器保持在线，详见 [图片回调](image-generation-api.md#图片-webhook-与延迟查询)。

提示词优化与规划同样受生成开关约束。检查、构建、部署、健康探测和签名拒绝测试均不需要调用真实付费模型；真实生成由用户按明确额度测试。

### 绑定与 Secrets

当前活动的账号、Hyperdrive、私有 R2、图片队列、死信队列和 `RealtimeHub` 命名空间用 `pnpm cf:check:config` 核对。仓库所需绑定以两个 Wrangler 配置为准。主站静态资产来自 `apps/web/dist`。

主站需要 `AUTH_JWT_SECRET`、`AUTH_PASSWORD_TURNSTILE_SITE_KEY`、`AUTH_PASSWORD_TURNSTILE_SECRET`、`ASSET_SIGNING_SECRET`、`STANDALONE_IMAGE_API_KEY`、`DEEPSEEK_API_KEY`、`IMAGE_WEBHOOK_SECRET`。图片 Worker 只需要媒体签名与两个模型密钥。普通变量、域名、Queue 和绑定以两个 Wrangler 配置为准。

Secrets 使用受保护输入或忽略的临时文件配置；不能写入 Git、命令参数、日志或前端。`backups/`、`.env*`、`.dev.vars*`、`.cloudflare/` 保持 Git 忽略，只有 `.env.example` 可提交。不得依赖开发进程自动继承生产基础设施凭据。

Creem 购买积分任务的审核由主站的 `CREEM_MODERATION_ENABLED` 控制。启用前把 `CREEM_API_KEY` 写入主站 Worker Secret，按测试／正式密钥分别使用 Creem 对应环境。启用 Creem 收款需要正确配置密钥和审核。Creem 在线收款由独立的 `BILLING_PROVIDER` 控制，默认为 `local`。启用前须完成迁移、在图片消费者配置同环境密钥、验证购买与逐图扣费、确认双钱包分账及审核范围满足 Creem 对正式收款的要求。邮件重审以正式环境的真实审核记录为准。操作见[钱包与计费](enterprise-wallet.md#creem-验证与切换)。 [Creem 审核文档](https://docs.creem.io/features/moderation)

### 发布前后检查

正式版本从 GitHub Actions 的 **Release → Run workflow** 发布。部署 job 使用 `cloudflare-production` 环境中的 `CLOUDFLARE_API_TOKEN`，按仓库 Wrangler 配置部署主站和图片 Worker。该环境只允许 main，数据库连接信息和应用密钥继续由 Cloudflare 管理。

1. 按 AGENTS.md 核对目标账号、Worker、Git 版本、迁移和用户授权；`pnpm check` 与隔离验证通过后再发布。
2. 有表结构变化时，先执行经审查的 PostgreSQL 追加迁移；应用不会自动 db push。
3. `pnpm cf:types` 生成绑定类型，`pnpm build` 构建前端并分别 dry run 两个 Worker。
4. 初次创建 DO 或修改跨 Worker 绑定时，先部署主站，再部署图片 Worker；仅修改前端时可只部署主站。凭据必须显式加载并校验目标。
5. 使用 `pnpm cf:check:config` 同时比较控制台设置和 100% 活动版本。控制台保存的草稿不等于当前正在处理请求的版本。
6. 验证首页、API、私有媒体拒绝与 WebSocket，再根据实际产品变化发布 `release.json` 公告。日志或配置修复不重复公告。

构建或 dry run 通过只说明制品可生成，不代表线上资源和模型可用。具体回放、消息、版本公告及隔离运行时测试见 [实时推送](realtime.md)。

### 请求生命周期

主站业务响应在持久化完成后，通过 ctx.waitUntil 投递实时 outbox 并关闭调用级数据库连接，避免消息传输延迟阻塞普通响应。SSE 仍保留连接至流结束；图片 outbox 唤醒继续由提交路径等待，模型生成仍在独立消费者中执行。后台消息投递失败保留持久 outbox，由恢复链路处理。waitUntil 有平台生命周期限制，不是持久任务执行器。
