# 架构与目录

一个 pnpm workspace 仓库，三个独立应用；前端 CSR，API 与 Worker 长驻 Node.js。
代码同仓不表示进程合并或强制一起发布。

| 路径 | 职责 |
| --- | --- |
| apps/web/src/app | 路由、共享应用壳（studio-shell.tsx）、providers |
| apps/web/src/features | 按业务功能组织：首页、身份、账户、素材、生图与图片编辑工作区 |
| apps/web/src/lib | 浏览器 API 客户端与工具 |
| apps/web/src/styles | 共享设计 tokens 与全局基础样式 |
| apps/api/src | Hono 入口、应用工厂、配置与组织隔离的生图 feature API |
| apps/worker/src | 队列消费者、生命周期与任务执行 |
| packages/contracts | 浏览器安全的 Zod 输入/输出定义，不含 DB 或 Node 依赖 |
| packages/db | PostgreSQL pool、Drizzle schema、迁移、持久化生成事件及 LISTEN/NOTIFY |
| packages/queue | 队列名、payload、连接配置 |
| packages/generation | 服务商契约、Vakv 同步生图适配与能力校验（真实渠道待验收） |
| packages/storage | 对象存储契约与私有本地图片存储/校验；签名对象存储待接入 |
| tests/e2e | 浏览器关键路径验收 |
| docs/design | 当前认可的设计参考 |
| .agents/skills | 锁定来源的团队技能快照 |

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
    ├── home/                     # 首页、共享创作输入与提示辅助
    │   ├── home-intro.tsx         # 首页渐变轮换标题，文案与间隔在 home-intro-config.ts
    │   └── dot-grid/             # React Bits 点阵源码适配，首页参数在 home-dot-grid-config.ts
    ├── assets/                   # 素材页、全屏素材库及其局部样式
    ├── generation/               # 生图请求、事件、会话草稿及工作台页面
    │   ├── composer/             # 比例选择、参数选中背景
    │   ├── models/               # 模型选择层卡片与下拉选择
    │   ├── references/           # 参考图上传、选择与缩略图
    │   └── history/              # 历史查询、任务信息、操作和定位
    └── image-workspace/          # 生成图详情、缩略图列表、统一画布与缩放
        └── local-edit/           # 局部修改面板、选区、草稿、提交及状态通知
```

- 先按业务功能归类，功能内部就近存放组件、hook、样式与单元测试；只有存在明确子职责时再增加目录，不为每个组件建立一层文件夹。
- 保留描述性文件名和直接导入，不新增 `index.ts` 聚合出口，也不建立覆盖所有功能的 components/hooks/services 分类目录。浏览器端到端测试仍在根目录 `tests/e2e`。
- `app/studio-shell.tsx` 组合导航、登录、账户和生图事件；路由页面留在各 feature。首页、工作台和素材页继续由路由懒加载，`image-workspace/preview-workspace.tsx` 及 Konva 继续按预览需要加载。
- `generation/generation-client.ts` 维护现有生图、历史和素材 API 查询与缓存，被历史、素材库和编辑工作区直接引用；目录维护不改变 query key 或增加请求层。
- `generation/studio-state.ts` 保留原有客户端草稿、跨页面交互状态及样例定义，现有引用直接指向它；目录归类不把样例转换成持久服务，也不改变状态生命周期。
- `image-workspace/local-edit` 负责编辑交互，调用生图请求；预览壳组合画布与编辑面板。底层请求不反向依赖页面。类型依赖继续使用 `import type`，不为目录入口建立运行时循环。
- `styles/fullscreen-dialog.css` 是图片详情与素材库共用的全屏动效；各功能 CSS 随对应组件导入。目录维护保持 DOM、class、样式内容、文案及交互逻辑不变。

## 依赖方向

web → contracts。api/worker → 服务包 → db/queue/storage/generation。
contracts 不得反向引用应用或 server-only 包；共享包不得依赖 apps。
业务 feature 内部用直接导入，不建立覆盖整站的大 barrel。
当前 packages 使用 TypeScript 源导出：开发通过 Vite/tsx 消费，
生产 API/Worker 由 tsup 内联 @lycoboai/*，启动 dist 时不依赖 TS 运行器。
这些包 private，不是可直接发布到 npm 的编译 SDK。

## 进程与服务

- API：短请求、身份、授权、参数校验、业务编排。
- Worker：有持久任务托管的后台工作，绝不能依赖浏览器连接。
- PostgreSQL：业务与状态真相。Redis：队列传输/调度。
- 对象存储：图片原件、缩略图、下载包；业务库只保存元数据和对象 key。
- SSE：状态变化信号；断线后按游标/数据库补查。

## 服务端模块约定

新增功能采用 features/<domain>/{routes,service,repository}.ts，按复杂度拆分。
路由不直接包含长 SQL 和计费流程。Repository 明确接收 owner/workspace 范围；
服务端解析身份。不要为三行纯函数制造多层依赖注入或类继承框架。

## 部署

静态前端独立部署，网关将同域名 /api/* 转发 Hono。API 和 Worker 可先在同机不同容器，
后续独立扩容。数据库池按进程管理；池大小 × 副本数必须小于数据库连接预算。
初始化尚未提供生产部署授权、域名绑定或上线认证。

## 生图服务端接入

- apps/api/src/features/images：组织访问令牌鉴权、图片上传/读取、模型能力、任务提交/查询、管理员核对。
- packages/contracts/src/image-generation.ts：独立生图输入契约与公开模型目录；不改变既有任务契约。
- packages/db/src/image-repository.ts：组织、令牌、任务、逐图 outbox 与积分账本持久化。
- packages/generation/src/vakv-provider.ts：Vakv 同步生图、能力开关、尺寸映射与不确定结果分类。
- apps/worker/src/image-worker.ts / image-processor.ts：独立生图队列、投递器、并发执行与租约处理。
- packages/storage/src/image-store.ts：服务端图片解码、去元数据、私有 PNG 文件与实际尺寸/哈希。

接口、工作台和登录的实现范围，以及供应商、存储等外部验收边界见 [生图 API 文档](docs/image-generation-api.md)。

实时任务通知入口为 apps/api/src/features/images/events.ts；apps/web/src/features/generation/use-image-events.ts 在应用壳维护共享 SSE 连接与 Query 缓存更新。事件日志和业务状态事务提交，独立于 Redis 生图执行队列；具体协议见 docs/image-generation-api.md。

- packages/db/src/wallet-repository.ts：企业共享钱包、充值订单与只读账务查询。数据表与扣费规则见 [企业钱包](docs/enterprise-wallet.md)。

## 前端组件边界

当前UI按[设计定稿](DESIGN.md)维护；组件拆分不得改变外观。公共组件在`apps/web/src/components`，场景功能按职责放在`features/<domain>`，避免在页面内重复实现上传、确认、图片浏览及操作。

- `GenerationHistory`：历史查询、空态、活动任务同步及预览入口。`HistoryImagePreview` 维护跨任务成功图片的稳定快照和分页；`ImagePreviewRail` 封装缩略图选择、高亮及自动定位。
- `HistoryTaskMeta`：模型、时间、任务编号复制和输出参数。
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

## 发布工具

版本发布由 `.github/workflows/release.yml` 显式触发，`scripts/release-notes.mjs` 生成提交分类、作者／提交人及文件改动清单。版本只发布已通过 main CI 的提交；发布日志与操作边界见 [发布说明](docs/releasing.md)。
