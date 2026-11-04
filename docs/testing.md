# 测试与验收

## 自动检查

- pnpm lint：Biome + 浏览器/server-only 边界检查。
- pnpm typecheck：所有 workspace 包 strict TypeScript。
- pnpm test：契约、API、Worker 的单元行为。
- pnpm build：实际前端和两个 Node 应用生产构建。
- pnpm test:e2e：真实 Chromium 下接口连接、路由、禁用态与窄屏溢出。
- pnpm test:integration：明确 opt-in 的本地 PostgreSQL 和 CloudBase RPC 集成验证。

首次运行浏览器测试需 pnpm exec playwright install chromium。
CI 使用 pnpm exec playwright install --with-deps chromium。
浏览器测试失败留 trace/report；测试使用本地应用，不能连接线上接口。

## 本地开发与远程回归

日常 AI 开发默认执行 `pnpm check` 和 `git diff --check`，不在每次样式、文案或布局调整后运行本地全量 E2E。关键交互变化、已知回归或用户明确要求时，只运行相关浏览器用例；例如 `pnpm test:e2e tests/e2e/preview-workspace.spec.ts`。不为纯视觉数值补写镜像测试。

按2026-10-31用户要求，浏览器验证改为手动运行，不阻塞日常提交、PR合并和main部署。自动CI保留Quality（lint、类型、单测、构建）及Infrastructure（数据库、队列、存储集成）。本地仅按需做定向浏览器验证，不默认运行全量。

## CI 浏览器检查

| 触发场景 | 浏览器范围 |
| --- | --- |
| 推送 dev/main、普通或发布PR | 不自动运行 |
| 手动运行 CI | 完整 `pnpm test:e2e`，可填写 `browser_grep` 定向诊断 |

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

`tests/e2e/image-preview.spec.ts` 验证全屏预览、缩放拖动、移动布局和图片切换后的说明同步；`library-dialog.spec.ts` 验证我的素材默认当前工具、页签与功能／模型筛选在分页前请求、重置、上传页签禁用筛选、服务端收藏与失败回滚、带筛选进入素材库、按天等高行与手机两列，以及弹层焦点恢复。接口均由浏览器 fixture 拦截，不调用模型。

素材库筛选与收藏的数据库约束由两处隔离检查覆盖：worker `test:images` 中的 `verify-asset-library.ts` 在真实 PostgreSQL 上验证工具与模型筛选（含服务商变体归并）、参考图不命中工具筛选、收藏幂等与成员隔离、跨组织与过期素材拒绝，以及每位成员1000项上限；api `test:cloudbase-images` 对 CloudBase RPC 应用新迁移后重复验证同样的筛选、收藏与上限。

并行执行不同测试任务时，为每次运行设置独立 `--output=/tmp/<本次运行目录>`，避免 Playwright 清理其他运行的 trace。历史时间断言使用浏览器自身时区计算，不能写死本机的 UTC+8 时间。完整 `pnpm test:e2e` 由远程 CI 手动触发；本地复现可指定文件或用例，不能以跳过失败用例代替查明原因。

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

`packages/generation/src/textile-generation.test.ts` 验证10个独立服务端视角预设、版本、重复与未知视角、普通任务4张上限和一视角一张约束；图片API测试验证客户端模型／提示词／质量无法覆盖服务端固定配置。

`verify-textile-generation.ts` 纳入 worker `test:images`，在隔离临时库与私有临时图片目录中验证10张提交、原子扣费及10条outbox、同键重放、跨组织引用拒绝、工具历史筛选、每个position不同提示词及每次请求携带有序的1张主图和5张详情图、重复消费不调用服务商、9成功1失败只按成功张数净扣、失败重试仅保留原position。服务商为本地注入fixture，未调用外部模型。

`tests/e2e/textile-generation.spec.ts` 使用接口fixture验证选中10视角后提交10张与六张有序参考、历史视角标记、部分失败与实时更新、刷新和重新编辑、普通创作历史隔离，以及丢失响应后刷新仍复用同一幂等键。全量浏览器测试可由远程CI手动运行。

结果布局回归 `generation-result-layout.spec.ts` 验证单图全宽原比例、多图中的失败／待确认项保持同列正方形且不跨行。供应商适配器单测分别覆盖响应头等待与响应体等待超时，确认`PROVIDER_TIMEOUT`仍为未知收费结果并且只调用一次，不自动重试。默认总超时600000ms，租约在其上增加60000ms，Redis桥接请求保留610000ms上限。

单图卡片重试由`card-image-retry.spec.ts`验证hover、键盘和触屏入口、单张金额确认、取消不提交、仅传itemId及丢失响应后刷新同键重放。隔离verify-textile-generation覆盖其他子项仍排队时仅替换选中未决项、另一个失败项不变、单次退款／扣费、同键换图拒绝与旧执行完成隔离。命名迁移回归先单独验证0015的数据保全，再应用后续扩展迁移，避免把新增可空列误判为旧数据变化。

浏览器测试通过 `scripts/local/dev.mjs --api-only` 启动隔离 Node API，再由 Playwright 启动前端。

浏览器CI固定使用 `ubuntu-24.04`，避免 `ubuntu-latest` 切换系统版本后依赖／字体下载和渲染环境漂移；浏览器任务使用匹配Playwright 1.64.0的官方 `mcr.microsoft.com/playwright:v1.64.0-noble` 镜像并固定digest，内置Chromium及系统字体依赖，不在任务中重复执行apt下载；完整E2E范围不变。

完整浏览器CI分为2个shard，每个独立runner使用1个worker，避免同机浏览器竞争资源；`Browser`汇总检查必须等待两个分片全部成功，不改变测试范围、断言或失败重跑规则。生成结果图使用服务端宽高保留加载前比例，使远处历史任务的懒加载预览入口有稳定尺寸。

## 私有 S3

`docker compose up -d image-storage` 后，`ALLOW_LOCAL_S3_INTEGRATION=true pnpm exec vitest run packages/storage/src/s3-object-bucket.test.ts` 使用固定 loopback:9004 的独立私有桶，真实 Images binding 处理 fixture，验证原图/PNG 缩略图/WebP 预览与缩略图写入、签名访问、匿名拒绝、R2 旧对象回退和清理。只创建随机 fixture key，结束删除自己的原图与变体，不调用付费模型。默认单元验证 S3 故障不能静默写回 R2；本地环境测试确保不会导入正式 S3 凭据。

套图计划接入测试：`variation-planner.test.ts` 覆盖计划JSON、独立提示词、坏结果及不自动重试；`verify-variation-plans.ts` 由隔离图片集成脚本执行，覆盖计划幂等、所有权、确认前不扣费、20方案创建、40积分原子扣款、20条outbox及历史隔离。`tests/e2e/smart-variation.spec.ts` 使用明确的API fixtures，检查文字校验、编辑/勾选/删除、跨工具保留草稿及确认后的单次提交，包含320/390/1440px。Fixture通过不代表外部语言供应商可用，外部实测另行记录结果。

独立主站配置由 `standalone-models.test.ts` 验证开关、密钥缺失时关闭、四模型路由与快照不包含密钥。`verify-standalone-models.ts` 随隔离图片集成运行，在临时库禁用后台模型目录后验证主站仍可创建任务、同键只扣一次、outbox和计划配置可用。`model-catalog.spec.ts` 验证后台目录503时不发送目录请求、四模型与本地SVG仍显示、图片加载失败回退；保留历史与预览名称一致断言。

2026-10-31 模型列表调整：主站仅提供 Image 2、Image 2.5、Banana 2.1、Banana Pro；Grok 与 Seedream 从可选目录和独立新任务路由移除，已有任务与素材名称保留。发布回归更新旧工具入口、展示名、1K转1.5K重试、草稿替换确认和移动素材入口断言，不恢复已移除的筛选／固定模型信息栏。

发布浏览器回归：按当前四模型展示名、工具导航、历史隔离、草稿载入确认、移动素材入口与1.5K参数更新旧断言；保持请求体、单次收费、退款、坐标和草稿保留验证。空历史居中规则降低选择器优先级，避免覆盖移动端创作视图对历史区的隐藏；390px家纺与空历史回归覆盖此问题。本地失败用例分组复验通过，完整套件可手动触发远程CI跑两分片。

结果恢复回归：独立主站集成覆盖3分钟超时、90秒领取租约、跨企业恢复拒绝、原task_id只读查询与恢复、旧执行token不能覆盖结果、恢复不重复扣费。浏览器定向检查未收到SSE通知时每5秒刷新并最终显示成功图片，成功后停止轮询。R2测试验证已校验PNG直接保存、原图与缩略预览版本完整、派生图失败保留原图，不因优化跳过格式或动画校验。

## CloudBase 共享 PG 鉴权事务

根 `pnpm test:integration` 已包含 `@lycoboai/db test:cloudbase-auth`。该检查只接受显式允许的 loopback PostgreSQL，每次新建独立数据库并执行完整迁移链和 CloudBase 鉴权 RPC，验证条件会话创建、并发刷新单次使用、改密原子撤销会话及匿名/普通登录角色拒绝执行服务端函数。无需 CloudBase 生产凭据，不写远端业务数据。

`@lycoboai/api test:cloudbase-images` 在独立临时库加载图片 RPC 及后续追加迁移，覆盖提交/claim/outbox 并发、扣费、退款、幂等、旧执行隔离与跨组织访问。计划 ready 后还会实际确认一张裂变图片，检查仅一笔扣费和一条 outbox、同键重放不重复收费，确定失败后退款；不仅验证计划生成。该回归已先复现 SQLSTATE 42702，再验证 `20261031235900_variation_plan_confirmation.sql` 修复。运行仍需显式 loopback DATABASE_URL 和 ALLOW_LOCAL_INTEGRATION=true，不调用付费供应商。

`cloudbase-outbox*.test.ts` 覆盖 Event 调用内继续取回异步结果：使用真实配置处理器与明确的内存持久化/HTTP fixtures，验证一次生成 POST、随后 GET、结果保存一次；同时验证最多两路操作、预算不足时保留 intent、没有后续 receipt 或结果未决时退出。测试不接触外部模型；原账务及 claim/outbox 不变量继续由隔离数据库测试覆盖。

图片 Webhook：`provider-webhook.test.ts` 覆盖原始字节签名、时间窗口、头部一致性和持久化后唤醒；`cloudbase-outbox-provider.test.ts` 覆盖异步等待释放消费者及超时后只 GET 原任务；`test:cloudbase-images` 在独立数据库验证早到/重复/持租约回调、迟到恢复、权限、租户隔离与计费。`generation-live.spec.ts` 中 pending history 用例验证无 SSE 时的批量查询收敛和完成后停止。所有中转调用均为模拟数据，不调用真实模型。

## 视频创作

视频接入的fixture验证包含在现有隔离命令中：`pnpm test:integration`里的`verify-videos`使用一次性本地数据库，验证100积分固定扣费、并发幂等、明确失败单次退款、无ID崩溃不重投、原任务下载、视频素材入库及图片流程隔离。HTTP供应商及对象桶为显式fixture，不消费真实供应商额度。

定向前台回归：`pnpm exec playwright test tests/e2e/video-creation.spec.ts tests/e2e/ratio-pager.spec.ts tests/e2e/library-dialog.spec.ts`。`tests/fixtures/video-playback.mp4`是ffmpeg生成的1秒64×64纯色视频测试文件，只验证浏览器媒体播放／按需加载，不是模型生成结果，也不用于产品展示。真实供应商生成、分组权限和CloudBase资源服务播放必须按[视频接入](video-generation.md)另行验收。

视频封面与播放验证：`packages/storage/src/video-variants.test.ts`使用真实解码器提取WebP，验证缓存合并、源文件保持不变、只派生封面及无效key拒绝；`video-media.test.ts`验证封面／播放／下载签名用途、内联播放Range、平台302跳转及封面不回退视频。`tests/fixtures/video-portrait.mp4`是ffmpeg生成的1秒90×162纯色视频，`video-cover.webp`为其真实帧，仅供测试，不是产品内容。定向`video-creation.spec.ts`验证列表只有封面、点击后才请求播放地址、附件仅在明确下载时通过本地fixture HTTP服务器传输、竖屏布局、详情信息栏、缩略图和方向键切换、有无Range时的进度条行为与关闭后焦点恢复。测试不调用模型。
