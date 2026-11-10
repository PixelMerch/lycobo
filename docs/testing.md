# 测试与验收

## 自动检查

- pnpm lint：Biome（警告也算失败）、浏览器/server-only 边界、HeroUI 组件约定和[代码质量约束](code-quality.md)。
- pnpm typecheck：所有 workspace 包 strict TypeScript。
- pnpm test：契约、API、Worker 的单元行为。
- pnpm build：实际前端和两个 Node 应用生产构建。
- pnpm test:e2e <spec 文件或 --grep>：定向浏览器测试；未指定范围会在启动浏览器前拒绝。
- pnpm test:e2e:full：完整浏览器回归，仅用户明确要求全量或远程手动回归时执行。
- pnpm test:integration：明确 opt-in 的隔离 PostgreSQL、队列、鉴权及持久事件集成验证。

首次运行浏览器测试需 pnpm exec playwright install chromium。
CI 使用 pnpm exec playwright install --with-deps chromium。
浏览器测试失败留 trace/report；测试使用本地应用，不能连接线上接口。

关键计费、恢复、推送规则与测试证据范围见[关键业务验证索引](business-test-map.md)，其中待验证场景不代表已覆盖。

## 按改动选择验证

开发中先执行相关测试，代码完成后仍运行 `pnpm check`。契约、身份或持久化行为跨域时扩大范围，不以文件位置代替影响分析。

- 文档：`pnpm docs:check` 与 `git diff --check`，人工核对功能事实；纯文档无需运行构建或浏览器用例。
- 检查脚本：`pnpm exec vitest run scripts/check-docs.test.mjs scripts/check-boundaries.test.mjs`，再完成全量质量检查。
- 登录与会话：API 鉴权相关测试；关键交互追加 `tests/e2e/login-history-sync.spec.ts`、`tests/e2e/session-renewal.spec.ts` 的相关用例。
- 任务、积分与回调：对应模块单测及本文隔离 DB/队列集成；不能只验证 HTTP 成功响应。
- 图片存储：`packages/storage/src` 对应测试；Cloudflare 绑定行为追加 `pnpm test:cloudflare`。
- 实时推送：`apps/web/src/features/realtime` 测试及 `pnpm test:cloudflare`；关键浏览器行为追加 `tests/e2e/realtime.spec.ts`、`tests/e2e/generation-live.spec.ts` 的相关用例。

检查结果记录对应提交/工作区依据。仅在代码、依赖或测试环境变化、失败或仍有风险时重跑；最终检查不能沿用不匹配的旧结果。完整浏览器回归仍只在远程 CI 手动触发。

## 本地开发与远程回归

纯按钮外观、间距、颜色和文案改动无需 E2E，也不新增截图镜像测试。关键交互或已知回归按用例选择范围；不要为了修改按钮样式执行完整回归。`pnpm check` 不包含 Playwright，`pnpm check:release` 现在也只运行同一质量检查。

日常 AI 开发默认执行 `pnpm check` 和 `git diff --check`，不在每次样式、文案或布局调整后运行本地全量 E2E。关键交互变化、已知回归或用户明确要求时，只运行相关浏览器用例；例如 `pnpm test:e2e tests/e2e/preview-workspace.spec.ts`。不为纯视觉数值补写镜像测试。

按2026-10-31用户要求，浏览器验证改为手动运行，不阻塞日常提交、PR合并和main部署。自动CI保留Quality（lint、类型、单测、构建）及Infrastructure（数据库、队列、存储集成）。本地仅按需做定向浏览器验证，不默认运行全量。

## CI 浏览器检查

| 触发场景                    | 浏览器范围                                                |
| --------------------------- | --------------------------------------------------------- |
| 推送 dev/main、普通或发布PR | 不自动运行                                                |
| 手动运行 CI                 | 完整 `pnpm test:e2e:full`，可填写 `browser_grep` 定向诊断 |

浏览器用例及两分片汇总保持保留；手动运行时必须报告实际成败，不伪造通过。分支保护由GitHub配置决定，不使用管理员绕过。

PR 标题校验拆为独立 `pr-title.yml`，仍报告 `PR title`。编辑标题或描述仅重跑该轻量工作流，不取消或重启完整 CI；新提交仍会触发完整的对应级别检查。改动 PR 目标分支则重新执行 CI，以免从 dev 改投 main 后沿用冒烟结果。纯元数据编辑的 CI 使用独立并发组和非必需检查名称并跳过任务，不覆盖之前的必需检查结果。此调整不改变 main 的分支保护。

## 本地 DB/队列集成

```sh
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

仅接受 loopback 的数据库 URL，且必须显式允许。
数据库测试在 loopback 服务插入唯一用户/项目/任务，验证归属和幂等约束，finally 清理并验证。
任务通过独立数据库中的 outbox 验证认领、幂等和计费；已删除旧平台队列模拟测试。
不调用模型、不扣积分、不上传对象。迁移可以在空白 CI 库上验证；
本地已有数据不能用清库方式测试。

## 手动验收

按 DESIGN.md 检查 390/768/1280/1440px、键盘操作、焦点返回、错误与空状态。
真实生图需使用明确授权的测试账户和限额，记录 provider 返回和结果存储证据。
不要把模拟完成动画或静态图称为端到端生成测试。

## 生图 API 集成

`pnpm test:integration` 现在同时运行诊断检查与 `@lycoboai/worker test:images`。
新增检查使用真实 PostgreSQL 、独立任务数据、临时私有图片目录和 loopback HTTP fixture；不调用付费模型。
配置、模型能力证据、身份签发和迁移边界见 [生图 API](image-generation-api.md)。

企业账号与 JWT 的隔离数据库测试已接入根集成命令，具体覆盖与运行边界见 [企业鉴权](enterprise-auth.md)。

## 实时事件与图片集成隔离

图片 API／Worker 集成测试现在创建独立临时数据库并执行完整迁移，配合临时图片目录；避免本地运行中的真实 Worker 抢到 fixture outbox。最终关闭连接后删除测试数据库，不接触共享数据或卷。

根 test:integration 已增加 `@lycoboai/api test:events`，覆盖 SSE 的持久化事件、跨连接通知、回滚、租户隔离、重连回放与身份撤销。运行需 loopback PostgreSQL 和 ALLOW_LOCAL_INTEGRATION=true；不会调用付费模型。

## 工作台浏览器回归

`tests/e2e/image-preview.spec.ts` 验证全屏预览、缩放拖动、移动布局和图片切换后的说明同步；`library-dialog.spec.ts` 验证我的素材默认当前工具、页签与功能／模型筛选在分页前请求、重置、上传页签禁用筛选、服务端收藏与失败回滚、带筛选进入素材库、按天分组与手机两列瀑布流，以及弹层焦点恢复。接口均由浏览器 fixture 拦截，不调用模型。

素材库筛选与收藏由 worker `test:images` 的 `verify-asset-library.ts` 在隔离 PostgreSQL 验证：功能、模型、收藏幂等与成员隔离、跨组织及过期素材拒绝、每位成员 1000 项上限。

并行执行不同测试任务时，为每次运行设置独立 `--output=/tmp/<本次运行目录>`，避免 Playwright 清理其他运行的 trace。历史时间断言使用浏览器自身时区计算，不能写死本机的 UTC+8 时间。完整 `pnpm test:e2e:full` 由远程 CI 手动触发；本地复现可指定文件或用例，不能以跳过失败用例代替查明原因。

浏览器 fixture 有三处容易出错：内联图片必须是校验正确的真实图片，新版 Chromium 拒绝解码 CRC 损坏的 PNG，参考图会停在“无法解码”；`<a download>` 发起的下载不经过 `page.route`，要核对下载内容时像 `video-creation.spec.ts` 那样起本地 HTTP 服务，否则只核对下载地址；参考图最多三张并行上传、到达顺序不固定，fixture 要按上传内容（例如图片宽度）而不是到达顺序分配素材 ID。

企业共享钱包测试纳入 worker test:images：verify-wallet.ts 验证主子账号并发扣款、固定单价、逐图退款、充值重复入账、账本不可修改和分页。wallet.spec.ts 验证账户中心真实接口契约（浏览器 fixture）。

弹层焦点回归同时覆盖鼠标点击和不预先聚焦的虚拟点击。受控预览在挂载时记录返回目标，因此打开前需聚焦入口按钮；预览入口位于 Modal 的触发器树外，由历史组件保留其引用，在关闭动画结束、弹层卸载后恢复焦点；弹层内部的焦点约束仍交给 HeroUI。不能通过预先在测试中 focus 或删除焦点断言掩盖问题。

原任务重试集成覆盖：同键并发只扣一次、跨组织拒绝、部分失败保留成功图片、旧执行被隔离、无效响应退币与历史待确认记录幂等修复。failure-retry.spec.ts 验证前端使用原任务 retry 接口，不追加失败历史。

通用生成命名升级由 `verify-generation-migration.ts` 纳入 worker `test:images`：
先在独立空库执行到 0013，创建七张旧表、素材和局部修改的关联数据，
再执行 0014 核对改名；建立旧视图依赖并确认 0015 删除受阻后，清理测试依赖再迁移。
验证八个旧名均消失，表 OID、记录、素材／修改关联、提交幂等和退款唯一性保持，
数据库函数不再引用旧表名。后续图片／钱包／SSE 检查全部在无兼容视图的结构上运行。
测试数据库和临时迁移目录结束后清理，不操作现有业务数据，也不调用付费模型。

## 家纺裂变

`packages/generation/src/images/textile-generation.test.ts` 验证10个独立服务端视角预设、版本、重复与未知视角、普通任务4张上限和一视角一张约束；图片API测试验证客户端模型／提示词／质量无法覆盖服务端固定配置。

`verify-textile-generation.ts` 纳入 worker `test:images`，在隔离临时库与私有临时图片目录中验证10张提交、原子扣费及10条outbox、同键重放、跨组织引用拒绝、工具历史筛选、每个position不同提示词及每次请求携带有序的1张主图和5张详情图、重复消费不调用服务商、9成功1失败只按成功张数净扣、失败重试仅保留原position。服务商为本地注入fixture，未调用外部模型。

`tests/e2e/textile-generation.spec.ts` 使用接口fixture验证选中10视角后提交10张与六张有序参考、历史视角标记、部分失败与实时更新、刷新和重新编辑、普通创作历史隔离，以及丢失响应后刷新仍复用同一幂等键。全量浏览器测试可由远程CI手动运行。

结果布局回归 `generation-result-layout.spec.ts` 验证单图与多图按原比例完整展示，失败／待确认项保留任务请求比例和原有顺序。供应商适配器单测分别覆盖响应头等待与响应体等待超时，确认`PROVIDER_TIMEOUT`仍为未知收费结果并且只调用一次，不自动重试。消费者在未指定供应商超时时使用600000ms，并为执行租约增加60000ms；实际领取租约及恢复期限由持久化仓储约束。生产通过 Cloudflare Queue 与 PostgreSQL outbox 执行，不再有 Redis 桥接请求。

单图卡片重试由`card-image-retry.spec.ts`验证hover、键盘和触屏入口、单张金额确认、取消不提交、仅传itemId及丢失响应后刷新同键重放。隔离verify-textile-generation覆盖其他子项仍排队时仅替换选中未决项、另一个失败项不变、单次退款／扣费、同键换图拒绝与旧执行完成隔离。命名迁移回归先单独验证0015的数据保全，再应用后续扩展迁移，避免把新增可空列误判为旧数据变化。

浏览器测试通过 `scripts/local/dev.mjs --api-only` 启动隔离 Node API，再由 Playwright 启动前端。

界面有简体中文与英文两种语言，页面使用 `/zh-CN` 与 `/en` 前缀，URL语言优先于本机偏好；语言路径、登录返回与草稿保留的专用回归见 `tests/e2e/locale-routing.spec.ts`，规则见[页面语言路径](localized-routing.md)。`playwright.config.ts` 把浏览器语言固定为 `zh-CN`，现有用例按中文文案定位；英文界面由 `tests/e2e/language.spec.ts` 单独覆盖：英文浏览器默认英文、日文浏览器回退英文、语言入口位于积分或登录左侧、切换后刷新仍保持、英文工作台，以及服务端中文错误按错误代码换成英文说明。单元测试运行在 Node 中，默认语言为英文；断言中文文案的测试在 `beforeEach` 里用 `useLocaleStore.setState({ locale: "zh-CN" })` 固定语言。

浏览器CI固定使用 `ubuntu-24.04`，避免 `ubuntu-latest` 切换系统版本后依赖／字体下载和渲染环境漂移；浏览器任务使用匹配Playwright 1.64.0的官方 `mcr.microsoft.com/playwright:v1.64.0-noble` 镜像并固定digest，内置Chromium及系统字体依赖，不在任务中重复执行apt下载；完整E2E范围不变。

完整浏览器CI分为2个shard，每个独立runner使用1个worker，避免同机浏览器竞争资源；`Browser`汇总检查必须等待两个分片全部成功，不改变测试范围、断言或失败重跑规则。生成结果图使用服务端宽高保留加载前比例，使远处历史任务的懒加载预览入口有稳定尺寸。

## 私有 S3

`docker compose up -d image-storage` 后，`ALLOW_LOCAL_S3_INTEGRATION=true pnpm exec vitest run packages/storage/src/buckets/s3-object-bucket.test.ts` 使用固定 loopback:9004 的独立私有桶，真实 Images binding 处理 fixture，验证原图/PNG 缩略图/WebP 预览与缩略图写入、签名访问、匿名拒绝、R2 旧对象回退和清理。只创建随机 fixture key，结束删除自己的原图与变体，不调用付费模型。默认单元验证 S3 故障不能静默写回 R2；本地环境测试确保不会导入正式 S3 凭据。

套图计划接入测试：`variation-planner.test.ts` 覆盖计划JSON、独立提示词、坏结果及不自动重试；`verify-variation-plans.ts` 由隔离图片集成脚本执行，覆盖计划幂等、所有权、确认前不扣费、20方案创建、40积分原子扣款、20条outbox及历史隔离。`tests/e2e/smart-variation.spec.ts` 使用明确的API fixtures，检查文字校验、编辑/勾选/删除、跨工具保留草稿及确认后的单次提交，包含320/390/1440px。Fixture通过不代表外部语言供应商可用，外部实测另行记录结果。

独立主站配置由 `standalone-models.test.ts` 验证开关、密钥缺失时关闭、四模型路由与快照不包含密钥。`verify-standalone-models.ts` 随隔离图片集成运行，在临时库禁用后台模型目录后验证主站仍可创建任务、同键只扣一次、outbox和计划配置可用。`model-catalog.spec.ts` 验证后台目录503时不发送目录请求、四模型与本地SVG仍显示、图片加载失败回退；保留历史与预览名称一致断言。

2026-10-31 模型列表调整：主站仅提供 Image 2、Image 2.5、Banana 2.1、Banana Pro；Grok 与 Seedream 从可选目录和独立新任务路由移除，已有任务与素材名称保留。发布回归更新旧工具入口、展示名、1K转1.5K重试、草稿替换确认和移动素材入口断言，不恢复已移除的筛选／固定模型信息栏。

发布浏览器回归：按当前四模型展示名、工具导航、历史隔离、草稿载入确认、移动素材入口与1.5K参数更新旧断言；保持请求体、单次收费、退款、坐标和草稿保留验证。空历史居中规则降低选择器优先级，避免覆盖移动端创作视图对历史区的隐藏；390px家纺与空历史回归覆盖此问题。本地失败用例分组复验通过，完整套件可手动触发远程CI跑两分片。

结果恢复回归：独立主站集成覆盖3分钟超时、90秒领取租约、跨企业恢复拒绝、原task_id只读查询与恢复、旧执行token不能覆盖结果、恢复不重复扣费。浏览器定向检查按推送更新结果，断线后按游标补齐，空闲时不定时查询任务。R2测试验证已校验PNG直接保存、原图与缩略预览版本完整、派生图失败保留原图，不因优化跳过格式或动画校验。

## 鉴权与持久事件

根 `pnpm test:integration` 在独立 loopback PostgreSQL 数据库中执行完整迁移链，覆盖会话创建、并发刷新、改密撤销、任务与 outbox 并发、扣费及退款幂等、跨组织拒绝和事件回滚。`verify-realtime.ts` 额外验证消息、个人已读、分页和批量投递确认；失败事件保留待重试。

图片 Webhook 单元测试验证原始字节签名、时间窗口与头部一致性；隔离图片集成验证提前、重复、迟到和持租约回调，以及无回调时只查询原任务。浏览器 `generation-live.spec.ts` 和 `realtime.spec.ts` 验证主动推送、断线游标、空闲无任务查询和资源请求去重，不调用真实供应商。

## 视频创作

视频接入的fixture验证包含在现有隔离命令中：`pnpm test:integration`里的`verify-videos`使用一次性本地数据库，验证100积分固定扣费、并发幂等、明确失败单次退款、无ID崩溃不重投、原任务下载、视频素材入库及图片流程隔离。HTTP供应商及对象桶为显式fixture，不消费真实供应商额度。

视频测试文件使用明确的本地 HTTP fixture 验证媒体播放和按需加载，不代表当前 Workers 已开放视频或已完成真实供应商验收。

视频封面与播放验证：`packages/storage/src/videos/video-variants.test.ts`使用真实解码器提取WebP，验证缓存合并、源文件保持不变、只派生封面及无效key拒绝；`video-media.test.ts`验证封面／播放／下载签名用途、内联播放Range、平台302跳转及封面不回退视频。`tests/fixtures/video-portrait.mp4`是ffmpeg生成的1秒90×162纯色视频，`video-cover.webp`为其真实帧，仅供测试，不是产品内容。定向`video-creation.spec.ts`验证列表只有封面、点击后才请求播放地址、附件仅在明确下载时通过本地fixture HTTP服务器传输、竖屏布局、详情信息栏、缩略图和方向键切换、有无Range时的进度条行为与关闭后焦点恢复。测试不调用模型。

账户弹框拆分回归由`account-center.spec.ts`、`account-menu.spec.ts`和`account-settings.spec.ts`覆盖：账单仅保留积分明细/充值订单，设置独立打开并恢复焦点，普通成员不显示企业管理，改密不匹配不提交、错误密码不退出、成功提交后清理当前登录状态。浏览器使用接口fixture，不修改真实账号密码；服务器改密和会话撤销仍由既有鉴权单测与隔离集成覆盖。

## Cloudflare Workers 迁移验证（2026-11-06）

当前生产以 [Cloudflare 部署](cloudflare-deployment.md) 为准。`pnpm test:integration` 使用独立本地 PostgreSQL 验证任务、outbox、鉴权和持久事件；Workers 平台行为由 `pnpm test:cloudflare` 验证。

`pnpm check` 的构建已包含 `pnpm cf:build`（Wrangler dry-run）。`pnpm test:cloudflare` 启动独立、本地 fixture Worker，不使用生产 Hyperdrive、R2 或密钥，验证 workerd 内现有 scrypt 密码兼容、Images 真实本地解码与 WebP 输出、R2 写入以及 Queue handler 投递。

新增 `cloudflare-uploads.test.ts` 覆盖暂存后不提前登记、上传人隔离、发送失败恢复、重复消息、存储故障、图片无效失败及登记后回执丢失恢复；`cloudflare.test.ts` 覆盖透明 PNG、展示图尺寸、标准化不重复编码、动画/超限拒绝和转换失败保留源结果。客户端测试验证等待真实素材和显式失败。`verify-cloudflare-isolation.ts` 随隔离图片集成检查素材登记幂等/内容冲突、新旧任务接管边界、旧执行不被自动过期、用户明确重试旧任务的新执行可领取，以及新任务重复领取拒绝。

这些检查不调用真实付费模型，不证明 Cloudflare 远端绑定可用，也不替代真实商品图的质量、延迟和费用验收。当前 Images 模拟与生产编码器的差异需在单独授权候选部署后验证；完整本地 E2E 仍不默认执行。

补充本地实测：实际应用 Worker（不是简化 fixture）使用一次性 PostgreSQL、本地 Hyperdrive/R2/Images/Queue 完成登录、202 上传、队列处理、素材登记、回执查询及签名缩略图读取；临时数据库已清理。定向 `pnpm exec playwright test tests/e2e/queued-reference-upload.spec.ts` 两项通过，覆盖未完成不提交生成及失败保留草稿/具体错误。测试未调用模型。

本次远端部署验证：主页与登录弹层、JSON API、Hyperdrive 读库及不存在账号登录拒绝正常；已有素材的签名 WebP/PNG 返回 200，未签名媒体返回 403；不存在上传意图的无副作用 Queue 探测消息已投递且积压归零。线上真实账号登录和有效图片上传/转换未验证，未调用付费模型。新增 `scripts/cloudflare-consumer.test.mjs` 验证生成关闭时仍处理上传，但不执行付费消息、不扫描或结算付费任务。

独立图片 Worker 的部署边界由 `scripts/cloudflare-deployment.test.mjs` 验证：主站没有 Queue/Cron handler，消费者没有 HTTP handler，复用同一持久队列、R2、Hyperdrive 和接管时间，两个配置均关闭付费执行且消费者不持有 JWT。`pnpm cf:build` 分别打包两个配置。

Webhook 与无回调兼容：`scripts/cloudflare-webhook.test.mjs` 验证 Workers API 挂载来源指纹和签名配置，生成关闭时仍可接收已存在任务的通知；`cloudflare-consumer.test.mjs` 验证无回调延迟查询、丢失回调 60 秒兜底和提前回调 2 秒核查。已有 provider/outbox 和隔离集成继续验证查询原任务不再次提交付费生成。配置变更不等于真实付费生成验收。

`pnpm cf:check:config` 是授权部署后的只读外部校验，不进入无凭据的默认 CI。`cloudflare-config.test.mjs` 覆盖活动版本正确但控制台草稿过期、仓库与活动版本不一致、Secret 名称缺失及完全一致的场景。

`pnpm test:cloudflare` 已增加真实 workerd 下的提示词优化 fixture：由原生 Request 验证请求选项，再消费模拟供应商 SSE 并完成结算。旧 `redirect:error` 在此检查中失败，改为 `manual` 后通过；Node 单测覆盖拒绝重定向、供应商拒绝请求时只结算一次，以及 SSE 尚未结束时不提前关闭仓储。

## Cloudflare 实时推送

`pnpm test:cloudflare` 覆盖独立本地 SQLite DO WebSocket 握手、自动心跳、组织隔离、重复游标、重连回放与失效会话关闭。worker `test:images` 增加 `verify-realtime.ts`，在隔离 PostgreSQL 验证回滚、钱包与任务事件、个人消息、幂等已读和分页。客户端单测确认空闲时不查询业务 API、重连携带游标、版本事件不刷新页面。详细限制与发布顺序见 [实时推送](realtime.md)。

## 运行边界与规则检查

本地 `pnpm lint` 同时运行全仓运行时边界、浏览器 server-only 导入、代码质量和中文注释检查。CI Infrastructure 在隔离数据库集成后增加 `pnpm test:cloudflare`，真实 workerd 检查不读取生产绑定或付费模型。完整浏览器回归仍仅由手动 workflow_dispatch 触发，普通 push／PR 不运行全套浏览器测试。

图片存储并行回归：`packages/storage/src/cloudflare/cloudflare-image-write.test.ts` 验证三路写入重叠、失败等待其余分支、源图保存与转换重叠及受控延迟比较；该模拟耗时不代表生产网络表现。真实本地 workerd 的 Images/R2 路径继续由 `pnpm test:cloudflare` 验证，不调用付费模型。
