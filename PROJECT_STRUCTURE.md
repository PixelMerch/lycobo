# 架构与目录

已完成的一次性迁移工具与旧平台资料已清理；当前数据库初始化只使用 Drizzle 追加迁移链。
`lycobo` 提供前端、Hono API 和签名媒体；`lycobo-images` 独立运行图片 Queue 与恢复 Cron。配置分别为根 `wrangler.jsonc` 和 `wrangler.images.jsonc`，可独立发布和回滚。代码同仓不表示进程合并或强制一起发布。

AI 开发按 [任务阅读索引](docs/ai-workflow.md) 读取相关目录和依赖方向，再追查调用方，不必为每个小任务全文读取本模块清单。根及相关目录 AGENTS 的要求仍全部适用。

| 路径                                 | 职责                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| apps/web/src/app                     | 路由、共享应用壳（studio-shell.tsx）、providers                                                |
| apps/web/src/features                | 按业务功能组织：首页、身份、账户、素材、生图与图片编辑工作区                                   |
| apps/web/src/lib                     | 浏览器 API 客户端与工具                                                                        |
| apps/web/src/i18n                    | 语言前缀、业务路径导航、语言偏好、文案目录与 HeroUI 语言同步；规则见 docs/localized-routing.md |
| apps/web/src/styles                  | 共享设计 tokens 与全局基础样式                                                                 |
| apps/api/src                         | Hono 入口、应用工厂、配置与组织隔离的生图 feature API                                          |
| apps/assets/src                      | 隔离本地开发的 Node/S3 资源服务；生产资源由 Workers 签名校验后读取 R2，缺失变体通过 Queue 补齐 |
| apps/worker/src                      | outbox 消费者、生命周期与任务执行                                                              |
| packages/contracts                   | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖                                           |
| packages/db                          | PostgreSQL pool、Drizzle schema、迁移、持久化生成事件及 LISTEN/NOTIFY                          |
| packages/queue                       | ID-only 消息契约、图片 outbox 投递与实时事件批量确认                                           |
| packages/generation                  | 服务商契约、Vakv 同步兼容、可配置 OpenAI／FluxPort 同异步适配与密钥加密                        |
| packages/storage                     | 私有 R2、Images binding 与 Queue 上传；Node Sharp/S3 仅供隔离开发和测试                        |
| scripts/check-cloudflare-runtime.mjs | 隔离 workerd、Images/R2 与密码验证                                                             |
| .github/ci/browser                   | 仅由 GitHub Actions 运行的浏览器关键路径验收                                                   |
| docs/design                          | 规范仍在引用的品牌素材                                                                         |
| .agents/skills                       | 锁定来源的团队技能快照                                                                         |

生图接口在 `apps/api/src/features/images/routes.ts` 统一注册会话、鉴权中间件和错误处理。任务、素材、规划、事件、模型和钱包由各自的路由模块注册到同一个 Hono 实例，业务服务和持久化仍在各自的层中。

## 共享包与后台任务目录

```text
packages/
├── db/src/              # auth / images / wallet / models / webhooks / realtime / planning / videos
│   ├── index.ts         # 稳定的包出口
│   ├── connection.ts    # 隔离本地开发的数据库连接池
│   └── schema.ts        # 既有表定义，迁移链不随目录重排
├── contracts/src/       # api / auth / images / models / planning / realtime / videos / wallet
├── generation/src/      # providers / planning / images / videos
├── storage/src/         # buckets / images / delivery / cloudflare / local / videos
└── queue/src/           # 小型共享消息包，保持简洁

apps/worker/
├── src/
│   ├── cloudflare.ts    # 生产入口
│   ├── local-consumer.ts # 隔离本地入口
│   ├── cloudflare/      # 绑定装配、Queue/Cron、变体处理
│   ├── images/          # 图片执行与供应商参考图
│   ├── queue/           # outbox 投递、租约与并发控制
│   ├── diagnostics/     # 隔离诊断任务
│   └── videos/          # 保留的历史实现，Workers 不调度
└── scripts/
    ├── check-*.ts       # 集成检查入口
    ├── verifications/  # 各业务的不变量验证
    └── fixtures/       # 本地供应商 fixture
```

目录代表职责，不代表新增进程或部署单元。包根 `index.ts` 和存储包已有 exports 保持对外路径稳定，内部直接导入具体模块，不增加子目录聚合出口。测试随被测模块移动；数据库历史迁移和运行入口不移动。

## 前端功能目录

```text
apps/web/src/
├── app/                          # 路由、应用壳（顶部导航栏、“电商”与语言悬停下拉、手机导航抽屉）、providers
├── components/                   # 跨功能复用的 HeroUI 组合与图片浏览基础能力
├── i18n/                         # 简体中文／English：语言检测与记忆、defineMessages 文案目录、页面 lang 与标题同步
├── lib/                          # 请求、会话、错误和剪贴板等通用能力
├── styles/                       # 共享 tokens、基础样式与全屏动效样式
└── features/
    ├── auth/                     # 身份请求、独立全屏登录页及登录方式切换
    ├── account/                  # 共享钱包请求、账户格式化及浮层组装
    │   ├── avatar/               # 预设头像配色与各处共用的账户头像
    │   ├── menu/                 # 顶部栏账户头像菜单、手机抽屉账户行和积分入口
    │   ├── center/               # 账户设置共用的弹窗外框、表格与窄屏样式
    │   ├── credits/              # 积分预览、明细、充值及订单
    │   ├── membership/           # 独立会员页和定价
    │   ├── settings/             # 账户设置、预设头像选择和密码表单
    │   └── notifications/        # 消息中心
    ├── workspace/                # 统一工作区布局、工具坞、跨工具草稿交接
    ├── commerce/                 # 家纺裂变、套图计划（方案规划、确认与生图）及本地会话草稿
    ├── video/                    # 视频页面、请求与草稿；history / player / production / storyboard 分职责
    ├── home/                     # 首页、共享创作输入与提示辅助
    │   ├── home-page.tsx        # 品牌首页、专区与工作区入口
    │   ├── landing/             # 电商专区首屏、家纺展台、效果对比、套图、规格与模板画廊；三段滚动共用 use-commerce-scroll.ts，章节切换在 use-scroll-chapter.ts，图带自动横移在 use-gallery-autoplay.ts；草稿带入在 use-template-remix.tsx
    │   ├── silk/                 # React Bits Silk 移植：着色器、WebGL 渲染器、动画状态与组件（来源见第三方材料）
    │   └── home-inspiration-gallery.tsx # 首页灵感筛选、示例预览、提示词带入；素材定义在 home-inspiration-data.ts，justified-rows.ts 按容器宽度（use-element-width.ts）算出等高行拼图
    ├── site/                     # 站点页脚：首页与用户协议、隐私政策页共用
    ├── legal/                    # 用户协议与隐私政策公开页；运营主体等待补信息集中在 legal-entity-messages.ts
    ├── assets/                   # 素材库页面与工作区全屏素材库：我的素材／灵感库标签、筛选、瀑布流、多选批量下载与收藏
    ├── generation/               # 生图请求、事件、会话草稿及工作台页面
    │   ├── composer/             # 比例选择、参数选中背景、图片与视频共用的单选参数行
    │   ├── models/               # 模型展示资料、Logo 与下拉选择
    │   ├── references/           # 共享参考图上传、`@` 引用、缩略图与参考图角色（reference-roles、reference-role-menu）
    │   └── history/              # 历史查询、任务信息、操作和定位
    └── image-workspace/          # 生成图详情、缩略图列表、统一画布与缩放
        └── local-edit/           # 局部修改面板、选区、草稿、提交及状态通知
```

- `components` 中参考图输入、参考图卡片、图片浏览和通用弹层分别在 `reference-prompt`、`reference-image`、`image-viewer`、`overlays`；基础图标、路由链接等小型公共组件留在根目录。`styles` 中 `auth`、`composer`、`history`、`home`、`workspace` 按用途归类，共享材质、主题和基础样式留在根目录，CSS 导入顺序保持稳定。
- 界面文案就近放在各功能的 `*-messages.ts`，用 `i18n/messages.ts` 的 `defineMessages` 同时写简体中文与英文两份，结构以中文版为准；组件用 `useMessages` 读取，组件之外用 `currentMessages`。
- 先按业务功能归类，功能内部就近存放组件、hook、样式与单元测试；只有存在明确子职责时再增加目录，不为每个组件建立一层文件夹。
- 保留描述性文件名和直接导入，不新增 `index.ts` 聚合出口，也不建立覆盖所有功能的 components/hooks/services 分类目录。
- 主导航统一使用工作区入口；`features/workspace` 组合参数子路由、随功能切换的历史及四个功能的直达工具栏；`workspace-tool-symbol.tsx` 共享功能入口与参数标题的图标身份，只使用Tabler矢量图标。
- `features/auth/login-prompt.tsx` 共享登录导航与首页创作交互门禁；Header及首页操作前往懒加载的 `/login`，`login-navigation.ts` 校验站内返回地址。`login-page.tsx` 在青柠丝绸背景（`login-backdrop.tsx`）上居中固定尺寸玻璃卡片并负责翻面，版式在同目录 `login-page.css`；`login-methods.tsx` 按服务端可用状态展示 Google、Apple 与邮箱入口，`social-login-client.ts` 发起本地 Supabase OAuth，`email-login.tsx` 处理邮箱验证码与 Turnstile，`enterprise-login.tsx` 保留真实密码认证。`app/studio-shell.tsx` 在登录状态确认前不挂载非首页业务内容，未登录时重定向；登录页不挂载应用壳或实时连接，回到业务页后按原有持久游标重连补齐。
- `app/studio-shell.tsx` 组合导航、身份门禁、账户和生图事件；`use-window-scrolled.ts` 提供页面是否离开顶部，顶部栏据此切换透明与滚动磨砂。路由页面留在各 feature。首页、工作台和素材页继续由路由懒加载，`image-workspace/preview-workspace.tsx` 及 Konva 继续按预览需要加载。
- `generation/generation-client.ts` 维护现有生图、历史和素材 API 查询与缓存，被历史、素材库和编辑工作区直接引用；目录维护不改变 query key 或增加请求层。
- `assets/asset-library-client.ts` 负责素材库查询（来源含 AI 生成的功能、类型、时间与仅看收藏，素材库页面写入地址栏）和服务端收藏：一个有上限的收藏 ID 查询供所有星标共用，切换乐观更新、失败回滚；`asset-browser.tsx` 组合 `asset-filters.tsx`、`asset-selection.tsx`（多选与批量下载，打包在 `asset-archive.ts`）、`asset-tile.tsx` 与现有图片预览，`asset-masonry.tsx` 订阅网格宽度并组合原比例瀑布流，`asset-layout.ts` 提供列数、按天分组与保持输入顺序的最短列定位纯函数。`asset-library-tabs.tsx` 是“我的素材 / 灵感库”标签行；`assets-page.tsx` 与 `library-dialog.tsx`（工作区打开，来源默认当前功能）只组合标签、浏览组件与首页的灵感作品墙。生成记录整组下载与素材批量下载共用 `generation/original-download.ts` 读取原文件。
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
- PostgreSQL：业务状态真相，Queue 与隔离本地消费者认领持久 outbox；DO 承担传输和短期回放。
- 对象存储：图片原件、缩略图、下载包；业务库只保存元数据和对象 key。
- WebSocket：统一推送任务、钱包、站内消息与版本；提示词优化保留 SSE。

## 服务端模块约定

新增功能采用 `apps/api/src/features/<domain>/{routes,service}.ts`，数据库读写放在 `packages/db/src/<domain>/<topic>-repository.ts`，按职责拆分。
路由不直接包含长 SQL 和计费流程。Repository 明确接收 owner/workspace 范围；
服务端解析身份。不要为三行纯函数制造多层依赖注入或类继承框架。

## 部署

两个 Worker 分别通过受控 Wrangler 流程发布。先运行 CI、核对授权、目标与迁移，再按 [Cloudflare 部署](docs/cloudflare-deployment.md) 验证活动版本、绑定和域名。GitHub Release 与数据库迁移分别授权，不由普通推送自动执行。

## 生图服务端接入

- apps/api/src/features/images：组织访问令牌鉴权、图片上传/读取、模型能力、任务提交/查询、管理员核对。
- packages/contracts/src/images/image-generation.ts：独立生图输入契约与公开模型目录；不改变既有任务契约。
- packages/db/src/images/image-repository.ts：管理连接池并组装生图仓储。身份、素材、历史、提交、执行和结算各自维护对应的持久化逻辑。提交模块在同一事务中写入任务、扣费和逐图 outbox。
- packages/generation/src/providers/vakv-provider.ts：同步兼容适配器，只留给隔离验证工具。
- apps/worker/src/cloudflare/cloudflare-consumer.ts / local-consumer.ts / images/image-processor.ts：生产 Queue/Cron、隔离本地 PG 消费和共享图片处理。
- packages/storage/src/local/image-store.ts：服务端图片解码、去元数据、私有 PNG 文件与实际尺寸/哈希。

接口、工作台和登录的实现范围，以及供应商、存储等外部验收边界见 [生图 API 文档](docs/image-generation-api.md)。

实时推送入口为 apps/api/src/features/realtime/（Hono 鉴权路由和 RealtimeHub DO）；apps/web/src/features/realtime/ 管理共享可休眠 WebSocket、消息与版本缓存；completion-observer.ts 观察现有任务缓存，completion-alerts.ts 与 completion-storage.ts 管理后台标题、完成提示及跨标签回执，features/account/settings/desktop-notification-setting.tsx 在账户偏好设置中提供手动桌面通知开关。任务、积分与消息的可靠事件使用 packages/db/src/realtime/realtime-repository.ts 和 realtime-schema.ts；API 与图片消费者通过 packages/queue/src/realtime.ts 投递。断线按游标回放，过期游标定向校准，不启用任务 API 定时轮询；提示词优化继续 SSE。详见 docs/realtime.md。

- packages/db/src/wallet/wallet-repository.ts：企业共享钱包、充值订单与只读账务查询。数据表与扣费规则见 [企业钱包](docs/enterprise-wallet.md)。

## 前端组件边界

当前UI按[设计定稿](DESIGN.md)维护；组件拆分不得改变外观。公共组件在`apps/web/src/components`，场景功能按职责放在`features/<domain>`，避免在页面内重复实现上传、确认、图片浏览及操作。

- `GenerationHistory`：历史查询、空态、活动任务同步及预览入口。`HistoryImagePreview` 维护跨任务成功图片的稳定快照和分页；`ImagePreviewRail` 封装缩略图选择、高亮及自动定位。
- `HistoryTaskMeta`：模型、时间、任务编号复制和输出参数。`components/collapsible-text.tsx` 共用历史提示词与详情创意描述的溢出测量、展开／收起和可访问状态；行数由各场景样式定义。
- `components/image-viewer/image-zoom-motion`：详情和参考图浏览共用滚轮灵敏度、输入限幅及缓动公式；`usePreviewZoom` 管理详情缩放目标、动画帧和滑块直接操作。
- `ResultImage`：生成图预览入口、下载和收藏；`generation-status`共用阶段标签和图标。
- `HistoryIndex`：右侧历史定位、选中滚动与我的素材入口。
- `ReferencePicker` / `ReferenceImageCard` / `ReferencePrompt`：共享上传、缩略图、图片引用。
- `components/image-viewer/image-viewer.tsx`：参考图浏览；`ImagePreviewDialog`：生成图详情壳、跨图切换和关闭。
- `PreviewDotGrid`：画布背景的静态点阵与鼠标波纹，按需绘制、尊重减少动态效果，不参与图片和选区的指针操作。
- `PreviewWorkspace`：懒加载的统一图片视口、缩放平移和模式切换；`PreviewCanvasToolbar`：官方工具栏组合；`ImagePreviewDetails`：原图信息栏；`LocalRepairPanel`：简化修改面板与提交状态；`RepairRegionCard`：编号选区的说明输入和删除，不暴露坐标表单。
- `useLocalRepair`：身份隔离草稿、最近一次已提交编辑的服务端恢复、选区历史和原有幂等提交／结果状态；`RepairCanvas`：原图坐标系上的透明选区交互层，不独立管理缩放或替换原图。
- `components/overlays/use-centered-dialog-motion`：预览和全屏素材库的公共开关动画，不通过feature转发导入。

功能组件使用直接依赖；服务端缓存属于TanStack Query，临时草稿与交互属于Zustand，纯展示组件从props获得数据。具体规则见[UI一致性维护](docs/ui-consistency.md)。

- `features/account/menu/account-menu.tsx` 组合HeaderLogin与账户菜单（桌面顶部栏头像、手机抽屉账户行）；菜单提供设置、个人作品与退出登录。`header-benefits.tsx` 是顶部栏积分胶囊与积分菜单（按参考站，悬停逻辑复用 `lib/use-hover-menu.ts`）；`credits/credit-usage-dialog.tsx`、`credit-usage-list.tsx` 与 `use-credit-usage.ts` 组成积分明细弹窗（视图筛选、按需续读与分页；从 Header 积分菜单打开）。`account-overlays.tsx` 通过Zustand记录弹窗及打开者，统一懒加载账户设置及叠在其上的充值、会员和积分明细；关闭后各自恢复焦点，退出或改密成功清空状态。
- `features/account/settings/account-settings-dialog.tsx` 是账户设置：左侧身份、分区与退出登录，分区为账户、套餐与用量、登录与安全及管理员可见的企业成员（`settings-sections.ts`）。`account-plan-usage.tsx` 组合当前套餐与升级、企业共享积分与充值，以及在积分明细（`credits/credit-ledger.tsx`）与充值订单（`credits/recharge-orders.tsx`）之间切换的积分用量；`account-password-form.tsx` 通过auth-client接入既有改密接口，成功清理登录状态。`account-settings-panels.tsx` 组合账户分区并如实保留未接入的子账号入口；`account-avatar-picker.tsx` 是头像行的预设单选，点选即通过auth-client的 `PUT /api/v1/auth/avatar` 保存。`account-language-picker.tsx` 与顶栏菜单复用 `use-account-language.ts`，已登录时通过 `PUT /api/v1/auth/locale` 保存语言偏好，再切换当前路由。`avatar/account-avatar.tsx` 是顶部栏、手机抽屉、账户菜单与设置共用的头像，按身份里的 `avatarPreset` 取 `account-avatar.css` 中的渐变，认不出时用默认青柠。`account-format.ts` 提供格式化，`account-entry.tsx` 提供收支图标；各页签查询按需挂载。
- `features/account/membership/membership-page.tsx` 导出懒加载全屏 MembershipDialog，Header在当前工作区打开；/membership仅为旧链接兼容入口，不展示返回与明细按钮；`MembershipPlans` 管理分类、周期、档位和团队席位展示；标语单价、周期最低折扣、折扣标签、单位积分价与“积分单价最低”飘带均由 `membership-pricing.ts` 的纯函数从价格表推导，并由同目录单元测试覆盖；membership-details组合工具／协作能力与Tooltip，membership-faq用官方Accordion承载本站FAQ，`CreditPacks` 只管理所选包。`wallet-client.ts` 共享钱包查询，最近记录按需读取并缓存30秒，不新增轮询。未接入的会员、绑定、验证码及支付不会模拟成功。

## 数据库领域命名

通用素材实体使用 `media_assets`（Drizzle `mediaAssets`），生成任务及其执行、投递、重试、事件、令牌和任务账本统一使用 `generation_*`；图片选区编辑扩展保留 `image_local_edits`。
表职责与媒体扩展边界见 [数据库命名](docs/database-naming.md)。

## 质量门禁

`scripts/check-boundaries.mjs`、`check-ui-conventions.mjs`、`check-code-quality.mjs` 和 `check-code-comments.mjs` 随 `pnpm lint` 运行。旧代码的违规记在 `scripts/code-quality-baseline.json`，只能减少，规则见 [代码质量约束](docs/code-quality.md)。

## 发布工具

合并到 main 仅执行 CI；用户授权后在 `.github/workflows/release.yml` 手动指定版本发布，`scripts/release-notes.mjs` 生成提交分类、作者／提交人及文件改动清单。版本只发布已通过 main CI 的提交；发布日志与操作边界见 [发布说明](docs/releasing.md)。

## 其他模块位置

- 主站模型能力 API：`apps/api/src/features/images/model-routes.ts`；仓库：`packages/db/src/models/model-management-repository.ts`；异步处理：`apps/worker/src/images/configured-image-processor.ts`。后台界面在独立 `../lycobo-admin`，通过受限代理调用本仓库平台授权接口；详见 [模型服务](docs/model-services.md)。
- 后台身份与模型配置路由已迁至独立 lycobo-admin API，主站不再挂载 model-management 管理路由。Drizzle 迁移仍统一存放本仓库；新增 admin_users、admin_sessions、admin_login_limits、admin_roles、admin_user_roles 无业务 users 外键，旧审计关系保留。当前共享数据库实例及模型配置，不代表物理库分离。
- 供应商请求协议注册表位于 packages/generation/src/providers/provider-adapters.ts，Gemini 原生响应归一化位于 gemini-protocol.ts，渠道可覆盖中转站默认协议并固定进任务快照；公共执行与下载在 configured-provider.ts，共享错误在 provider-errors.ts。供应商 URL、Key、型号、能力与超时仅由后台渠道提供；API 和 Worker 运行时不再回退 VAKV_* 环境配置。
- 历史记录整组下载：`apps/web/src/features/generation/history/history-download-button.tsx` 管理原图签名获取、读取取消、打包状态及浏览器下载；`history-download.ts` 选择已完成任务的成功项并按顺序打包ZIP，fflate仅在下载时加载，不改变单张下载与资源授权。
- 模型渠道的可选 `upstreamModelsByResolution` 配置按 1K／2K／4K 选择上游模型，随任务保存到供应商快照；未配置的分辨率回退到 `upstreamModel`。前端仍提交公共模型与分辨率，不感知供应商模型名。适配器的 `size` 按比例计算：1K 最长边 1024、2K 最长边 2048、4K 最长边 3840，尺寸对齐到 16 像素；4K 正方形为 `3840x3840`。
- 主站各模型入口共用 `useModelPresentation`，展示资料来自 `models/model-presentation.ts`。模型编码使用有格式限制的动态字符串，渠道与任务快照继续由服务端校验；新增模型未绑定渠道时不可生成，历史供应商别名保留兼容。
- 共享列表分页在 `components/infinite-load.tsx`，组合 IntersectionObserver 与 HeroUI Spinner；主站分页列表统一复用，业务查询仍由各功能的 TanStack Query hook 管理。提示词有效描述判断在 `features/generation/references/prompt-description.ts`，首页与创作页共用。
- 套图计划：`variation-planner.ts` 封装 OpenAI 兼容语言分析；`variation-service.ts` 负责参考素材归属校验与解密密钥；计划阶段仅优化文本和参考图编号，不读取或发送图片，参考图保留至实际生图阶段；`variation-repository.ts` 持久化计划和幂等状态。`model_planners` 独立配置语言模型；`generation_jobs.input.variation` 保存确认后的方案快照，Worker 每条方案只请求一张图。
- 参考图角色与套图逐条参考图：前端 `features/generation/references/reference-roles.ts` 记录会话内角色、`reference-role-menu.tsx` 是缩略图角色胶囊，`features/commerce/smart-variation/plan-image-bindings.ts` 计算每条方案的用图（没标原图时按全部方案提示词推断逐条对应的原图）、`plan-reference-strip.tsx` 显示并切换；服务端 `packages/generation/src/images/reference-roles.ts` 选出每条输出要发送的参考图并写角色或编号说明，Worker 的 `provider-references.ts` 按它读取参考图。
- 主站独立试用路由由 `packages/generation/src/images/standalone-models.ts` 定义；API/消费者将纯配置注入图片仓储，绕过后台模型目录、路由及语言模型设置读取。前端展示在 `models/model-presentation.ts`，Logo 位于 `apps/web/public/model-logos/`。不会删除后台表或改变鉴权/积分/素材持久化。
- Cloudflare 入口为 `apps/api/src/cloudflare.ts`，API 组合在 `cloudflare-app.ts`；`apps/worker/src/cloudflare/cloudflare-consumer.ts` 处理 Queue/Cron，`cloudflare/cloudflare-runtime.ts` 创建调用级资源。PostgreSQL 与钱包仍由原生仓储维护，绑定与状态见 [Cloudflare 部署准备](docs/cloudflare-deployment.md)。
- 图片回调接收位于 `apps/api/src/features/images/webhooks/provider-webhook.ts`；任务与事件的持久化关联位于 `packages/db/src/webhooks/provider-webhook-repository.ts`。前端主动推送、服务端超时补查和发布顺序见 [图片 Webhook](docs/image-webhooks.md)。
- 视频接入使用 `packages/contracts/src/videos/video-generation.ts`（六种比例、5–30秒整数时长、每次100积分）、`apps/api/src/features/videos`（薄路由和服务）、`packages/db/src/videos/video-repository.ts`（固定 PostgreSQL 业务操作）。任务与单个执行项复用generation_jobs／generation_job_items以保留钱包外键，generation_video_outbox独立维护持久意图、租约、供应商任务ID与下一次查询时间；图片历史和超时扫描排除视频。`apps/worker/src/videos/video-processor.ts` 为保留的历史实现，当前 Workers 不调度，供应商协议在 `packages/generation/src/videos/video-provider.ts`；MP4容器校验在storage/videos/video-media，资源服务提供短期签名与Range。服务端复用生图密钥STANDALONE_IMAGE_API_KEY；当前 Workers 和本地 API 不启用视频提交，运行边界见[视频接入](docs/video-generation.md)。
- 视频分镜通过 `features/videos/storyboard-planner.ts` 与现有套图计划服务调用 DeepSeek，使用已有计划记录保存分析结果并复用图像任务的幂等、扣费和 outbox。前端 `features/video/storyboard` 保存会话内的已受理阶段与幂等请求，等待图片任务完成后自动按原分镜顺序优化提示词并提交视频。右侧进度复用视频历史查询。
- 远端数据库工具：`packages/db/scripts/migrate-supabase.mjs` 复用当前 Drizzle 迁移链，`supabase-target.mjs` 校验目标项目与 Session Pooler；`secure-supabase.mjs` 维护业务表、序列与函数的服务端权限。生产经 Hyperdrive 使用该 PostgreSQL，不在 Worker 内执行结构迁移。

图片存储的受限并行编排位于 `packages/storage/src/cloudflare/cloudflare-image-write.ts`，由 `cloudflare.ts` 调用；原图和两个变体完成后才返回，遥测只记录阶段与耗时。

`apps/web/src/styles/overlay-glass.css` 统一 HeroUI 浮层的毛玻璃材质与减少透明回退；全屏会员页按具名例外使用稳定实底；消息中心布局与状态卡片由 `features/account/notifications/account-messages.css` 维护。

主图制作统一位于 `/commerce/create`，默认 `gpt-image-2.6`，模型选择按 2.6、2.5、2 排列。`mainImageModelIds` 统一前后端主图选项；历史展示资料和其他工具保留原有型号。首页与工作台共用草稿，首页提示词最多 5000 字，操作栏独立于自动伸展输入区。
