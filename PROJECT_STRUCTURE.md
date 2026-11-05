# 架构与目录

一个 pnpm workspace 仓库，四个独立应用：前端、API、消费者和图片服务，当前网站运行在 CloudBase，使用共享 PG 和私有云存储。CloudBase 保留作国内内测；海外 Supabase 新加坡已完成独立数据库快照复制，海外应用与媒体尚未部署。分别见 [CloudBase 部署](docs/cloudbase-deployment.md)与[双环境部署](docs/overseas-deployment.md)。
代码同仓不表示进程合并或强制一起发布。

| 路径                  | 职责                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/src/app      | 路由、共享应用壳（studio-shell.tsx）、providers                                                                                                                         |
| apps/web/src/features | 按业务功能组织：首页、身份、账户、素材、生图与图片编辑工作区                                                                                                            |
| apps/web/src/lib      | 浏览器 API 客户端与工具                                                                                                                                                 |
| apps/web/src/styles   | 共享设计 tokens 与全局基础样式                                                                                                                                          |
| apps/api/src          | Hono 入口、应用工厂、配置与组织隔离的生图 feature API                                                                                                                   |
| apps/assets/src       | 独立 Node 私有媒体资源服务：短期签名、Referer/CORS、WebP 展示变体缓存、原图下载、旧图 Sharp 变体补生成，经授权后按需生成并缓存真实视频封面，以及原视频内联播放（Range） |
| apps/worker/src       | outbox 消费者、生命周期与任务执行                                                                                                                                       |
| packages/contracts    | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖                                                                                                                    |
| packages/db           | PostgreSQL pool、Drizzle schema、迁移、持久化生成事件及 LISTEN/NOTIFY                                                                                                   |
| cloudbase/migrations  | CloudBase 共享 PG 的源库结构基线与约束恢复；原 Drizzle 历史随数据复制保留                                                                                               |
| packages/queue        | ID-only 消息契约与通用 outbox 投递；CloudBase 消费者直接认领 PG outbox，通用投递接口用于隔离集成测试                                                                    |
| packages/generation   | 服务商契约、Vakv 同步兼容、可配置 OpenAI／FluxPort 同异步适配与密钥加密                                                                                                 |
| packages/storage      | CloudBase PG 私有存储、UID 路径、Node Sharp 变体；S3 适配用于本地开发和迁移，CloudBase 不回退旧存储                                                                     |
| scripts/cloudbase     | 静态及 Linux 云函数发布包准备、固定目标配置与敏感文件隔离                                                                                                               |
| tests/e2e             | 浏览器关键路径验收                                                                                                                                                      |
| docs/design           | 规范仍在引用的品牌素材                                                                                                                                                  |
| .agents/skills        | 锁定来源的团队技能快照                                                                                                                                                  |

生图接口在 `apps/api/src/features/images/routes.ts` 统一注册会话、鉴权中间件和错误处理。任务、素材、规划、事件、模型和钱包由各自的路由模块注册到同一个 Hono 实例，业务服务和持久化仍在各自的层中。

## 前端功能目录

```text
apps/web/src/
├── app/                          # 路由、应用壳、providers
├── components/                   # 跨功能复用的 HeroUI 组合与图片浏览基础能力
├── lib/                          # 请求、会话、错误和剪贴板等通用能力
├── styles/                       # 共享 tokens、基础样式与全屏动效样式
└── features/
    ├── auth/                     # 身份请求与登录弹窗
    ├── account/                  # 侧栏账户菜单、独立账单与设置弹窗、钱包请求和账务展示
    ├── workspace/                # 统一工作区布局、工具坞、跨工具草稿交接
    ├── commerce/                 # 家纺裂变、套图计划（方案规划、确认与生图）及本地会话草稿
    ├── video/                    # 视频创作参数、自动成片流程、草稿、视频历史、封面与按需预览播放器
    ├── home/                     # 首页、共享创作输入与提示辅助
    │   ├── home-inspiration-gallery.tsx # 首页灵感筛选、示例预览、提示词带入；素材定义在 home-inspiration-data.ts，use-inspiration-columns.ts 订阅断点并派生均衡瀑布流
    │   └── home-grid-motion.tsx   # 按需加载的Grid Motion背景、视差与可见性暂停；参数在react-bit-config.ts
    ├── assets/                   # 素材库页面、全屏我的素材与共用浏览组件（筛选、密度网格、收藏）
    ├── generation/               # 生图请求、事件、会话草稿及工作台页面
    │   ├── composer/             # 比例选择、参数选中背景、图片与视频共用的单选参数行
    │   ├── models/               # 模型展示资料、Logo 与下拉选择
    │   ├── references/           # 共享参考图上传、`@` 引用与缩略图
    │   └── history/              # 历史查询、任务信息、操作和定位
    └── image-workspace/          # 生成图详情、缩略图列表、统一画布与缩放
        └── local-edit/           # 局部修改面板、选区、草稿、提交及状态通知
```

- 先按业务功能归类，功能内部就近存放组件、hook、样式与单元测试；只有存在明确子职责时再增加目录，不为每个组件建立一层文件夹。
- 保留描述性文件名和直接导入，不新增 `index.ts` 聚合出口，也不建立覆盖所有功能的 components/hooks/services 分类目录。浏览器端到端测试仍在根目录 `tests/e2e`。
- 主导航统一使用工作区入口；`features/workspace` 组合参数子路由、随功能切换的历史及四个功能的直达工具栏；`workspace-tool-symbol.tsx` 共享功能入口与参数标题的图标身份，只使用Tabler矢量图标。
- `features/auth/login-prompt.tsx` 共享登录请求与首页创作交互门禁；Header及首页操作共用应用壳的一份登录弹窗。`app/studio-shell.tsx` 在登录状态确认前不挂载非首页业务内容，登录成功保留目标地址、取消返回首页，生图事件仅在登录后挂载。
- `app/studio-shell.tsx` 组合导航、登录、账户和生图事件；路由页面留在各 feature。首页、工作台和素材页继续由路由懒加载，`image-workspace/preview-workspace.tsx` 及 Konva 继续按预览需要加载。
- `generation/generation-client.ts` 维护现有生图、历史和素材 API 查询与缓存，被历史、素材库和编辑工作区直接引用；目录维护不改变 query key 或增加请求层。
- `assets/asset-library-client.ts` 负责素材库查询（生成／上传／收藏与功能、类型、模型筛选，素材库页面写入地址栏）和服务端收藏：一个有上限的收藏 ID 查询供所有星标共用，切换乐观更新、失败回滚；`asset-browser.tsx` 组合页签、`asset-filters.tsx`、`asset-tile.tsx` 与现有图片预览，`asset-masonry.tsx` 订阅网格尺寸并组合原比例瀑布流，`asset-layout.ts` 提供按天分组与保持输入顺序的最短列定位纯函数。`assets-page.tsx` 与 `library-dialog.tsx`（我的素材，功能默认当前工具）只组合该浏览组件。
- `generation/studio-state.ts` 保留原有客户端草稿、跨页面交互状态及样例定义，现有引用直接指向它；目录归类不把样例转换成持久服务，也不改变状态生命周期。
- `image-workspace/local-edit` 负责编辑交互，调用生图请求；预览壳组合画布与编辑面板。底层请求不反向依赖页面。类型依赖继续使用 `import type`，不为目录入口建立运行时循环。
- `styles/fullscreen-dialog.css` 是图片详情与素材库共用的全屏动效；各功能 CSS 随对应组件导入。目录维护保持 DOM、class、样式内容、文案及交互逻辑不变。

## 依赖方向

web → contracts。api/worker/assets → 服务包 → db/queue/storage/generation。
contracts 不得反向引用应用或 server-only 包；共享包不得依赖 apps。
业务 feature 内部用直接导入，不建立覆盖整站的大 barrel。
当前 packages 使用 TypeScript 源导出：开发通过 Vite/tsx 消费，
前端由 Vite 打包，Node API 由 tsup 打包；本地开发使用隔离 Node 进程、PostgreSQL 与私有 S3。
这些包 private，不是可直接发布到 npm 的编译 SDK。

## 进程与服务

本地入口为 `scripts/local/dev.mjs`：Vite、Node API、独立 PG outbox 消费者和图片服务。业务基础设施固定使用本地 PostgreSQL 与私有 S3；详见 [本地开发](docs/development.md)。

- API：短请求、身份、授权、参数校验、业务编排。
- Worker：有持久任务托管的后台工作，绝不能依赖浏览器连接。
- PostgreSQL：业务与状态真相；CloudBase Event 消费者和本地独立消费者认领持久 outbox。
- 对象存储：图片原件、缩略图、下载包；业务库只保存元数据和对象 key。
- SSE：状态变化信号；断线后按游标/数据库补查。

## 服务端模块约定

新增功能采用 features/<domain>/{routes,service,repository}.ts，按复杂度拆分。
路由不直接包含长 SQL 和计费流程。Repository 明确接收 owner/workspace 范围；
服务端解析身份。不要为三行纯函数制造多层依赖注入或类继承框架。

## 部署

main 的 CI 成功后更新三个 CloudBase 函数代码并发布静态前端，使用 cloudbase-production Environment，见 [CloudBase 部署](docs/cloudbase-deployment.md)。

## 生图服务端接入

- apps/api/src/features/images：组织访问令牌鉴权、图片上传/读取、模型能力、任务提交/查询、管理员核对。
- packages/contracts/src/image-generation.ts：独立生图输入契约与公开模型目录；不改变既有任务契约。
- packages/db/src/image-repository.ts：管理连接池并组装生图仓储。身份、素材、历史、提交、执行和结算各自维护对应的持久化逻辑。提交模块在同一事务中写入任务、扣费和逐图 outbox。
- packages/generation/src/vakv-provider.ts：同步兼容适配器，只留给隔离验证工具。
- apps/worker/src/cloudbase-consumer.ts / local-consumer.ts / image-processor.ts：生产 Event、本地 PG 消费及共享任务处理。
- packages/storage/src/image-store.ts：服务端图片解码、去元数据、私有 PNG 文件与实际尺寸/哈希。

接口、工作台和登录的实现范围，以及供应商、存储等外部验收边界见 [生图 API 文档](docs/image-generation-api.md)。

实时任务通知入口为 apps/api/src/features/images/events.ts；apps/web/src/features/generation/use-image-events.ts 在应用壳维护共享 SSE 连接，无 SSE（CloudBase 默认）时只轮询未完成任务，二者经 task-sync.ts 定向更新 Query 缓存。事件日志和业务状态事务提交，独立于生图消费者；具体协议见 docs/image-generation-api.md。

- packages/db/src/wallet-repository.ts：企业共享钱包、充值订单与只读账务查询。数据表与扣费规则见 [企业钱包](docs/enterprise-wallet.md)。

## 前端组件边界

当前UI按[设计定稿](DESIGN.md)维护；组件拆分不得改变外观。公共组件在`apps/web/src/components`，场景功能按职责放在`features/<domain>`，避免在页面内重复实现上传、确认、图片浏览及操作。

- `GenerationHistory`：历史查询、空态、活动任务同步及预览入口。`HistoryImagePreview` 维护跨任务成功图片的稳定快照和分页；`ImagePreviewRail` 封装缩略图选择、高亮及自动定位。
- `HistoryTaskMeta`：模型、时间、任务编号复制和输出参数。`components/collapsible-text.tsx` 共用历史提示词与详情创意描述的溢出测量、展开／收起和可访问状态；行数由各场景样式定义。
- `components/image-zoom-motion`：详情和参考图浏览共用滚轮灵敏度、输入限幅及缓动公式；`usePreviewZoom` 管理详情缩放目标、动画帧和滑块直接操作。
- `ResultImage`：生成图预览入口、下载和收藏；`generation-status`共用阶段标签和图标。
- `HistoryIndex`：右侧历史定位、选中滚动与我的素材入口。
- `ReferencePicker` / `ReferenceImageCard` / `ReferencePrompt`：共享上传、缩略图、图片引用。
- `components/ImageViewer`：参考图浏览；`ImagePreviewDialog`：生成图详情壳、跨图切换和关闭。
- `PreviewDotGrid`：画布背景的静态点阵与鼠标波纹，按需绘制、尊重减少动态效果，不参与图片和选区的指针操作。
- `PreviewWorkspace`：懒加载的统一图片视口、缩放平移和模式切换；`PreviewCanvasToolbar`：官方工具栏组合；`ImagePreviewDetails`：原图信息栏；`LocalRepairPanel`：简化修改面板与提交状态；`RepairRegionCard`：编号选区的说明输入和删除，不暴露坐标表单。
- `useLocalRepair`：身份隔离草稿、最近一次已提交编辑的服务端恢复、选区历史和原有幂等提交／结果状态；`RepairCanvas`：原图坐标系上的透明选区交互层，不独立管理缩放或替换原图。
- `components/use-centered-dialog-motion`：预览和全屏素材库的公共开关动画，不通过feature转发导入。

功能组件使用直接依赖；服务端缓存属于TanStack Query，临时草稿与交互属于Zustand，纯展示组件从props获得数据。具体规则见[UI一致性维护](docs/ui-consistency.md)。

- `features/account/account-menu.tsx` 组合HeaderLogin与侧栏账户菜单；积分与账单、设置分别打开独立弹窗。`header-benefits.tsx` 保留余额概览与会员入口。`account-overlays.tsx` 通过Zustand记录弹窗及打开者，统一懒加载账单、设置和会员；关闭后各自恢复焦点，退出或改密成功清空状态。
- `features/account/account-center-dialog.tsx` 承载积分明细、充值订单两个页签，默认打开积分明细；`account-settings-dialog.tsx` 承载个人资料、登录与安全及管理员可见的企业成员。`account-profile.tsx` 共用紧凑账号信息条；`account-password-form.tsx` 通过auth-client接入既有改密接口，成功清理登录状态。`account-settings-panels.tsx` 如实保留未接入的头像、微信、子账号入口。`account-format.ts` 提供格式化，`account-entry.tsx` 提供收支图标；各页签查询按需挂载。
- `features/account/membership-page.tsx` 导出懒加载全屏 MembershipDialog，Header在当前工作区打开；/membership仅为旧链接兼容入口，不展示返回与明细按钮；`MembershipPlans` 管理分类、周期、档位和团队席位展示；标语单价、周期最低折扣、折扣标签、单位积分价与“积分单价最低”飘带均由 `membership-pricing.ts` 的纯函数从价格表推导，并由同目录单元测试覆盖；membership-details组合工具／协作能力与Tooltip，membership-faq用官方Accordion承载本站FAQ，`CreditPacks` 只管理所选包。`wallet-client.ts` 共享钱包查询，最近记录按需读取并缓存30秒，不新增轮询。未接入的会员、绑定、验证码及支付不会模拟成功。

## 数据库领域命名

通用素材实体使用 `media_assets`（Drizzle `mediaAssets`），生成任务及其执行、投递、重试、事件、令牌和任务账本统一使用 `generation_*`；图片选区编辑扩展保留 `image_local_edits`。
表职责与媒体扩展边界见 [数据库命名](docs/database-naming.md)。

## 质量门禁

`scripts/check-boundaries.mjs`、`check-ui-conventions.mjs` 和 `check-code-quality.mjs` 随 `pnpm lint` 运行。旧代码的违规记在 `scripts/code-quality-baseline.json`，只能减少，规则见 [代码质量约束](docs/code-quality.md)。

## 发布工具

合并到 main 且 CI 通过后，`.github/workflows/release.yml` 自动发布版本，`scripts/release-notes.mjs` 生成提交分类、作者／提交人及文件改动清单。版本只发布已通过 main CI 的提交；发布日志与操作边界见 [发布说明](docs/releasing.md)。

## 其他模块位置

- 模型配置 API：`apps/api/src/features/model-management`；仓库：`packages/db/src/model-management-repository.ts`；异步处理：`apps/worker/src/configured-image-processor.ts`。后台界面在独立 `../lycobo-admin`，通过受限代理调用本仓库平台授权接口；详见 [模型服务](docs/model-services.md)。
- 后台身份与模型配置路由已迁至独立 lycobo-admin API，主站不再挂载 model-management 管理路由。Drizzle 迁移仍统一存放本仓库；新增 admin_users、admin_sessions、admin_login_limits、admin_roles、admin_user_roles 无业务 users 外键，旧审计关系保留。当前共享数据库实例及模型配置，不代表物理库分离。
- 供应商请求协议注册表位于 packages/generation/src/provider-adapters.ts，Gemini 原生响应归一化位于 gemini-protocol.ts，渠道可覆盖中转站默认协议并固定进任务快照；公共执行与下载在 configured-provider.ts，共享错误在 provider-errors.ts。供应商 URL、Key、型号、能力与超时仅由后台渠道提供；API 和 Worker 运行时不再回退 VAKV_* 环境配置。
- 历史记录整组下载：`apps/web/src/features/generation/history/history-download-button.tsx` 管理原图签名获取、读取取消、打包状态及浏览器下载；`history-download.ts` 选择已完成任务的成功项并按顺序打包ZIP，fflate仅在下载时加载，不改变单张下载与资源授权。
- 模型渠道的可选 `upstreamModelsByResolution` 配置按 1K／2K／4K 选择上游模型，随任务保存到供应商快照；未配置的分辨率回退到 `upstreamModel`。前端仍提交公共模型与分辨率，不感知供应商模型名。适配器的 `size` 按比例计算：1K 最长边 1024、2K 最长边 2048、4K 最长边 3840，尺寸对齐到 16 像素；4K 正方形为 `3840x3840`。
- 主站各模型入口共用 `useModelPresentation`，展示资料来自 `models/model-presentation.ts`。模型编码使用有格式限制的动态字符串，渠道与任务快照继续由服务端校验；新增模型未绑定渠道时不可生成，历史供应商别名保留兼容。
- 共享列表分页在 `components/infinite-load.tsx`，组合 IntersectionObserver 与 HeroUI Spinner；主站分页列表统一复用，业务查询仍由各功能的 TanStack Query hook 管理。提示词有效描述判断在 `features/generation/references/prompt-description.ts`，首页与创作页共用。
- 套图计划：`variation-planner.ts` 封装 OpenAI 兼容语言分析；`variation-service.ts` 负责参考素材归属校验与解密密钥；计划阶段仅优化文本和参考图编号，不读取或发送图片，参考图保留至实际生图阶段；`variation-repository.ts` 持久化计划和幂等状态。`model_planners` 独立配置语言模型；`generation_jobs.input.variation` 保存确认后的方案快照，Worker 每条方案只请求一张图。
- 主站独立试用路由由 `packages/generation/src/standalone-models.ts` 定义；API/消费者将纯配置注入图片仓储，绕过后台模型目录、路由及语言模型设置读取。前端展示在 `models/model-presentation.ts`，Logo 位于 `apps/web/public/model-logos/`。不会删除后台表或改变鉴权/积分/素材持久化。
- CloudBase 运行入口为 `apps/api/src/index.ts`（API）、`apps/api/src/assets-server.ts`（私有图片）、`apps/worker/src/cloudbase-consumer.ts`（独立 Event 消费者）。`packages/db/src/cloudbase-*` 通过固定 SQL 业务函数访问共享 PG，原 Node 原生 PG 仓储用于本地/旧部署。实际状态和限制见 [CloudBase 部署](docs/cloudbase-deployment.md)。
- 图片回调接收位于 `apps/api/src/features/images/provider-webhook.ts`；任务与事件的持久化关联位于 `packages/db/src/provider-webhook-repository.ts`。前端低频批量同步、超时补查和发布顺序见 [图片 Webhook](docs/image-webhooks.md)。
- 视频接入使用 `packages/contracts/src/video-generation.ts`（六种比例、5–30秒整数时长、每次100积分）、`apps/api/src/features/videos`（薄路由和服务）、`packages/db/src/video-repository.ts`（Node／CloudBase同一固定RPC）。任务与单个执行项复用generation_jobs／generation_job_items以保留钱包外键，generation_video_outbox独立维护持久意图、租约、供应商任务ID与下一次查询时间；图片历史和超时扫描排除视频。`apps/worker/src/video-processor.ts` 由现有本地消费者与CloudBase Event入口调度，供应商协议在 `packages/generation/src/video-provider.ts`；MP4容器校验在storage/video-media，资源服务提供短期签名与Range。服务端复用生图密钥STANDALONE_IMAGE_API_KEY；默认启用视频，缺少密钥或存储配置时不接受付费提交，运行边界见[视频接入](docs/video-generation.md)。
- 视频分镜通过 `features/images/storyboard-planner.ts` 与现有套图计划服务调用 DeepSeek，使用已有计划记录保存分析结果并复用图像任务的幂等、扣费和 outbox。前端 `features/video/storyboard` 保存会话内的已受理阶段与幂等请求，等待图片任务完成后自动按原分镜顺序优化提示词并提交视频。右侧进度复用视频历史查询。
- 海外数据库工具：`packages/db/scripts/migrate-supabase.mjs` 复用现有 Drizzle Kit 迁移链，`supabase-target.mjs` 校验独立的 `SUPABASE_DATABASE_URL` 与项目引用，支持直连及 Session Pooler；`secure-supabase.mjs` 限定本应用表／序列／函数的 RLS 和前端角色权限。当前网站仍使用 CloudBase 共享 PG；海外数据库复制不自动切换运行时，详见[双环境部署](docs/overseas-deployment.md)。
