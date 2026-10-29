# 架构与目录

一个 pnpm workspace 仓库，四个独立应用；前端 CSR 部署 Pages，API 与队列消费者部署 Cloudflare Workers。
代码同仓不表示进程合并或强制一起发布。

| 路径 | 职责 |
| --- | --- |
| apps/web/src/app | 路由、共享应用壳（studio-shell.tsx）、providers |
| apps/web/src/features | 按业务功能组织：首页、身份、账户、素材、生图与图片编辑工作区 |
| apps/web/src/lib | 浏览器 API 客户端与工具 |
| apps/web/src/styles | 共享设计 tokens 与全局基础样式 |
| apps/api/src | Hono 入口、应用工厂、配置与组织隔离的生图 feature API |
| apps/assets/src | 独立私有图片资源 Worker：短期签名、Referer/CORS、WebP 预览／缩略图缓存、原图下载及旧图 Images 补生成 |
| apps/worker/src | 队列消费者、生命周期与任务执行 |
| packages/contracts | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖 |
| packages/db | PostgreSQL pool、Drizzle schema、迁移、持久化生成事件及 LISTEN/NOTIFY |
| packages/queue | ID-only 消息契约、持久 outbox 投递、开发专用 HTTP sender；线上使用 Cloudflare Queues |
| packages/generation | 服务商契约、Vakv 同步兼容、可配置 OpenAI／FluxPort 同异步适配与密钥加密（真实渠道待验收） |
| packages/storage | 私有对象存储接口、统一 S3 配置/寻址、可选历史 R2 回退、UID 路径和 Images 变体；Node 本地存储供隔离测试 |
| tests/e2e | 浏览器关键路径验收 |
| docs/design | 当前认可的设计参考 |
| .agents/skills | 锁定来源的团队技能快照 |

创作导航的后台 Logo 由 features/generation/models/model-logos.tsx 通过 TanStack Query 读取公开元数据；API 的 image-model-logos 返回现有公开模型 id、name、logoUrl、description 与 capabilitySummary，数据库层按目录标识显式映射，不返回供应商配置。

## 前端功能目录

```text
apps/web/src/
├── app/                          # 路由、应用壳、providers
├── components/                   # 跨功能复用的 HeroUI 组合与图片浏览基础能力
├── lib/                          # 请求、会话、错误和剪贴板等通用能力
├── styles/                       # 共享 tokens、基础样式与全屏动效样式
└── features/
    ├── auth/                     # 身份请求与登录弹窗
    ├── account/                  # Header账户菜单、账户中心、钱包请求和账务展示
    ├── commerce/                 # AI 电商导航、最近功能入口偏好、家纺主图裂变工作区、生成提交与本地会话草稿
    ├── home/                     # 首页、共享创作输入与提示辅助
    │   ├── home-inspiration-gallery.tsx # 首页灵感筛选、示例预览、提示词带入；素材定义在 home-inspiration-data.ts
    │   ├── home-intro.tsx         # 首页渐变轮换标题，文案与间隔在 home-intro-config.ts
    │   └── dot-grid/             # React Bits 点阵源码适配，首页参数在 home-dot-grid-config.ts
    ├── assets/                   # 素材页、全屏素材库及其局部样式
    ├── generation/               # 生图请求、事件、会话草稿及工作台页面
    │   ├── composer/             # 比例选择、参数选中背景
    │   ├── models/               # 创作直达入口、整行悬停模型小卡片与下拉选择
    │   ├── references/           # 参考图上传、选择与缩略图
    │   └── history/              # 历史查询、任务信息、操作和定位
    └── image-workspace/          # 生成图详情、缩略图列表、统一画布与缩放
        └── local-edit/           # 局部修改面板、选区、草稿、提交及状态通知
```

- 先按业务功能归类，功能内部就近存放组件、hook、样式与单元测试；只有存在明确子职责时再增加目录，不为每个组件建立一层文件夹。
- 保留描述性文件名和直接导入，不新增 `index.ts` 聚合出口，也不建立覆盖所有功能的 components/hooks/services 分类目录。浏览器端到端测试仍在根目录 `tests/e2e`。
- `components/feature-navigation.tsx` 组合创作／AI 电商的直达入口、整行悬停与非模态竖向卡片菜单，样式在同目录；各 feature 仅维护模型／功能内容及选择行为。`components/use-hover-menu.ts` 共享账户及模型菜单的悬停、键盘焦点恢复逻辑。
- `app/studio-shell.tsx` 组合导航、登录、账户和生图事件；路由页面留在各 feature。首页、工作台和素材页继续由路由懒加载，`image-workspace/preview-workspace.tsx` 及 Konva 继续按预览需要加载。
- `generation/generation-client.ts` 维护现有生图、历史和素材 API 查询与缓存，被历史、素材库和编辑工作区直接引用；目录维护不改变 query key 或增加请求层。
- `generation/studio-state.ts` 保留原有客户端草稿、跨页面交互状态及样例定义，现有引用直接指向它；目录归类不把样例转换成持久服务，也不改变状态生命周期。
- `image-workspace/local-edit` 负责编辑交互，调用生图请求；预览壳组合画布与编辑面板。底层请求不反向依赖页面。类型依赖继续使用 `import type`，不为目录入口建立运行时循环。
- `styles/fullscreen-dialog.css` 是图片详情与素材库共用的全屏动效；各功能 CSS 随对应组件导入。目录维护保持 DOM、class、样式内容、文案及交互逻辑不变。

## 依赖方向

web → contracts。api/worker/assets → 服务包 → db/queue/storage/generation。
contracts 不得反向引用应用或 server-only 包；共享包不得依赖 apps。
业务 feature 内部用直接导入，不建立覆盖整站的大 barrel。
当前 packages 使用 TypeScript 源导出：开发通过 Vite/tsx 消费，
生产 API/Worker 由 Wrangler 打包 @lycoboai/*，Pages Functions 用服务绑定访问 API。Node API 构建只保留为调试入口。
这些包 private，不是可直接发布到 npm 的编译 SDK。

## 进程与服务

本地通过 `docker compose up` 启动本地 PostgreSQL、Redis 与 `studio`（Vite + Wrangler API/消费者/独立图片资源 Worker）；入口为 `scripts/cloudflare/docker-dev.sh` 与 `dev.mjs`。启动环境由 `local-environment.mjs` 固定为本地连接并清除线上凭据。R2/Images 使用本地模拟；本地队列使用 Redis Streams，`redis-dev.mjs` 通过认证桥接调用本地 Worker，生成的 `wrangler.local.json` 不含 Cloudflare Queue 绑定。图片由本地独立资源 Worker（cdn.lycobo.localhost:8791）通过签名 URL 提供，业务 API 不传输图片字节；数据库、模拟状态、Redis 和 Linux 依赖分别保存于 Docker 卷。具体命令见 [本地开发](docs/development.md)。

- API：短请求、身份、授权、参数校验、业务编排。
- Worker：有持久任务托管的后台工作，绝不能依赖浏览器连接。
- PostgreSQL：业务与状态真相。Cloudflare Queues：只传任务 ID 的持久投递。
- 对象存储：图片原件、缩略图、下载包；业务库只保存元数据和对象 key。
- SSE：状态变化信号；断线后按游标/数据库补查。

## 服务端模块约定

新增功能采用 features/<domain>/{routes,service,repository}.ts，按复杂度拆分。
路由不直接包含长 SQL 和计费流程。Repository 明确接收 owner/workspace 范围；
服务端解析身份。不要为三行纯函数制造多层依赖注入或类继承框架。

## 部署

同一仓库管理 Pages、Hono API Worker、Queues 消费者。API 与消费者共用 R2、Images 和关闭查询缓存的 Hyperdrive，数据库为 Supabase。`scripts/cloudflare` 提供资源准备、受限秘密上传与顺序部署；配置、测试和远端实际状态分别记录，见 [Cloudflare 部署](docs/cloudflare-deployment.md)。

## 生图服务端接入

- apps/api/src/features/images：组织访问令牌鉴权、图片上传/读取、模型能力、任务提交/查询、管理员核对。
- packages/contracts/src/image-generation.ts：独立生图输入契约与公开模型目录；不改变既有任务契约。
- packages/db/src/image-repository.ts：组织、令牌、任务、逐图 outbox 与积分账本持久化。
- packages/generation/src/vakv-provider.ts：Vakv 同步生图、能力开关、尺寸映射与不确定结果分类。
- apps/worker/cloudflare/index.ts / src/image-processor.ts：Queues 消费、Cron outbox 恢复、并发执行与租约处理。
- packages/storage/src/image-store.ts：服务端图片解码、去元数据、私有 PNG 文件与实际尺寸/哈希。

接口、工作台和登录的实现范围，以及供应商、存储等外部验收边界见 [生图 API 文档](docs/image-generation-api.md)。

实时任务通知入口为 apps/api/src/features/images/events.ts；apps/web/src/features/generation/use-image-events.ts 在应用壳维护共享 SSE 连接与 Query 缓存更新。事件日志和业务状态事务提交，独立于 Cloudflare Queues 生图执行队列；具体协议见 docs/image-generation-api.md。

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

- `features/account/HeaderAccountMenu` 封装Header登录态、积分与头像合并入口、账户下拉菜单及账户弹窗；`StudioShell` 仅组合入口，不重复持有账号查询和菜单状态。个人作品复用素材库路由，账户资料、订阅与账单、账号管理由 `AccountPanel` 承接。
- 账户独立弹窗由 `features/account/account-panel.tsx` 按入口组合，仅挂载所选功能、不提供跨功能 Tab：`AccountManagement` 封装绑定／重置密码的可用状态与表单，`WalletPanel` 封装真实共享余额、收支筛选和充值订单，`account-panel.css` 维护与个人信息一致的深色表面及中性灰输入焦点。未接入的账号绑定、验证码和支付不会模拟成功。

## 数据库领域命名

通用素材实体使用 `media_assets`（Drizzle `mediaAssets`），生成任务及其执行、投递、重试、事件、令牌和任务账本统一使用 `generation_*`；图片选区编辑扩展保留 `image_local_edits`。
表职责、已完成的旧视图移除与后续媒体扩展边界见 [数据库命名](docs/database-naming.md)。

## Supabase 结构迁移

`packages/db/scripts/migrate-supabase.mjs` 复用现有 Drizzle Kit 迁移链，`supabase-target.mjs` 校验独立的 `SUPABASE_DATABASE_URL` 与项目引用，`secure-supabase.mjs` 限定本应用表／序列／函数的 RLS 和前端角色权限。生产 Workers 通过 Hyperdrive 访问同一 Supabase，秘密与资源配置见 Cloudflare 部署文档。`pnpm db:migrate:supabase --check` 仅检查配置；填写真实密码后才可实际初始化远端结构。此入口不复制本地业务数据、图片文件或修改现有迁移；连接、Data API 边界和 MCP 操作见 [Supabase 接入](docs/supabase-postgres.md)。

## 发布工具

版本发布由 `.github/workflows/release.yml` 显式触发，`scripts/release-notes.mjs` 生成提交分类、作者／提交人及文件改动清单。版本只发布已通过 main CI 的提交；发布日志与操作边界见 [发布说明](docs/releasing.md)。

模型配置 API：`apps/api/src/features/model-management`；仓库：`packages/db/src/model-management-repository.ts`；异步处理：`apps/worker/src/configured-image-processor.ts`。后台界面在独立 `../lycobo-admin`，通过受限代理调用本仓库平台授权接口；详见 [模型服务](docs/model-services.md)。

2026-10-27：后台身份与模型配置路由已迁至独立 lycobo-admin API，主站不再挂载 model-management 管理路由。Drizzle 迁移仍统一存放本仓库；新增 admin_users、admin_sessions、admin_login_limits、admin_roles、admin_user_roles 无业务 users 外键，旧审计关系保留。当前共享数据库实例及模型配置，不代表物理库分离。

供应商请求协议注册表位于 packages/generation/src/provider-adapters.ts，Gemini 原生响应归一化位于 gemini-protocol.ts，渠道可覆盖中转站默认协议并固定进任务快照；公共执行与下载在 configured-provider.ts，共享错误在 provider-errors.ts。供应商 URL、Key、型号、能力与超时仅由后台渠道提供；API 和 Worker 运行时不再回退 VAKV_* 环境配置。

历史记录整组下载：`apps/web/src/features/generation/history/history-download-button.tsx` 管理原图签名获取、读取取消、打包状态及浏览器下载；`history-download.ts` 选择已完成任务的成功项并按顺序打包ZIP，fflate仅在下载时加载，不改变单张下载与资源授权。

模型渠道的可选 `upstreamModelsByResolution` 配置按 1K／2K／4K 选择上游模型，随任务保存到供应商快照；未配置的分辨率回退到 `upstreamModel`。前端仍提交公共模型与分辨率，不感知供应商模型名。适配器的 `size` 按比例计算：1K 最长边 1024、2K 最长边 2048、4K 最长边 3840，尺寸对齐到 16 像素；4K 正方形为 `3840x3840`。本地家纺裂变的 1K／2K／4K 统一使用 `gpt-image-2.5`；线上配置独立管理。

模型公开目录由 `modelManagementRepository.logos` 按图片类别、启用状态和排序查询，主站各模型入口共用 `useModelPresentation`。模型编码使用有格式限制的动态字符串，渠道与任务快照继续由服务端校验；新增模型未绑定渠道时不可生成，历史供应商别名保留兼容。
