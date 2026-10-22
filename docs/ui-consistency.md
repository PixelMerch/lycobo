# UI 一致性与组件维护

更新：2026-10-22。当前网站视觉已经用户确认定稿；维护目标是保持现有 UI、消除重复实现、让规范与代码一致。视觉唯一来源为 [DESIGN.md](../DESIGN.md)，交互组件清单为 [HeroUI 组件清单](heroui-components.md)。不根据设计技能的通用推荐重新换色、改尺寸或重排页面。

## 组件分层

| 层次 | 职责 | 当前入口 |
| --- | --- | --- |
| 应用与页面 | 路由、布局、场景组合，不复制底层交互 | router、StudioShell、HomePage、WorkspacePage、AssetsPage |
| 功能组件 | 拥有一个完整功能及其局部交互 | ReferencePicker、HistoryTaskActions、LocalRepair、LibraryDialog |
| 展示组件 | 明确输入和事件，不自行请求无关业务 | HistoryTaskMeta、ResultImage、ModelChooserCard |
| 共享交互组合 | 组合 HeroUI，统一可复用的完整行为 | ConfirmDialog、DialogClose、ImageViewer、ReferencePrompt |
| 状态与同步 | 服务端数据用 TanStack Query，客户端草稿用 Zustand；hook只同步外部系统 | generation-client、wallet-client、studio-state、use-image-events |
| 视觉 | 全局token＋功能样式；不新增相互竞争的基础控件样式 | styles/app.css、components/*.css、features/**/*.css |

按功能边界拆分，不为了行数把静态片段变成几十个只有一个调用方的包装。反之，查询、任务元信息、图片操作、右侧索引、预览状态不应长期挤在一个页面组件里。跨功能使用共享组件的真实路径，不保留仅转发导出的兼容文件，也不建立全站 barrel。

## 已固定的共享能力

| 能力 | 唯一入口 | 维护约束 |
| --- | --- | --- |
| 确认 | ConfirmDialog | 不在业务中复制 Modal 标记；正文与操作布局共用 |
| 关闭 | DialogClose | 图标与命中区分开，确认弹窗沿用33px hover圆底 |
| 参考图片上传 | ReferencePicker → ReferenceImageCard | 首页与工作台共用；删除、编号、预览不复制 |
| 图片引用 | ReferencePrompt | 文本序列化、@候选、行内图片展示共用 |
| 参考图片浏览 | ImageViewer | 历史、详情、上传入口按需加载同一组件 |
| 生成图片操作 | ResultImage | 预览、下载、收藏、焦点入口由同一组件承担 |
| 任务元信息 | HistoryTaskMeta | 标签、时间、比例、任务ID复制一致 |
| 历史索引 | HistoryIndex | 定位与滚动同步；“我的素材”标题固定、列表独立滚动；不承担重试或草稿覆盖 |
| 生成阶段 | generation-status | 中文状态与生成图标共用，不从颜色推断状态 |
| 全屏开关动画 | components/use-centered-dialog-motion | 关闭动画结束后卸载；不复制 hook |
| 请求错误 | useErrorToast | 去重、统一顶部反馈；字段校验继续用FieldError/Alert |

纯展示组件不增加另一份服务端状态；在父级派生数据，通过props传递。Zustand订阅选择所需字段，不用effect维持可在render计算的冗余状态。支付、鉴权、计费和任务快照不属于视觉重构范围。

## 设计与代码清理流程

1. 先读用户最新要求、Git状态、PRD、DESIGN和组件清单，标出已有未提交工作。当前定稿只允许保持视觉的重构；新视觉需求另行明确。
2. 用UI/UX Pro Max核对层级、状态反馈、触屏和响应式；用React技能核对状态与组件边界。研究结果与用户定稿冲突时保留定稿，不生成另一份MASTER规范。
3. 核对安装的HeroUI API，再组合官方组件。选Button size、variant、isIconOnly，选择控件用ToggleButtonGroup / Select，不手写aria-pressed单选、菜单键盘或焦点陷阱。
4. 拆分时保留DOM语义、class、事件、焦点恢复和计费边界。先移功能单元，再删旧定义和转发；不顺便升级依赖、技能、主题token。
5. 删除代码前检查导入、动态字符串路径、CSS类、文档、测试与素材清单。无静态import不能单独证明public资源无用；成套删除已停用数据、专属样式和资源，并同步索引。
6. 对仍在运行的UI检查桌面与窄屏、长文案、禁用、键盘焦点、加载和嵌套关闭。浏览器实测与自动化fixture各有边界，不能把fixture成功当成真实渠道验收。
7. 执行pnpm check、pnpm test:e2e、git diff --check。发现失败查清原因，记录实际结果；只提交任务相关路径，不夹带本地技能或工具目录。

## 自动约束与覆盖边界

pnpm lint运行`scripts/check-ui-conventions.mjs`，以TypeScript AST识别组件导入别名，拒绝：

- 裸button/input/select/textarea/a及原生元素伪装的交互role。
- Radix、Headless UI、直接React Aria基础件等第二套primitives。
- HeroUI Button/ToggleButton使用onClick或手写aria-pressed。
- Button/ToggleButton中的内联尺寸、padding、radius。

原生隐藏file input是文件选择的具名例外，可见入口仍为HeroUI Button。路由适配使用RouterLink，不重做链接键盘。图形编辑等HeroUI没有覆盖的领域按项目已有canvas组件执行。

静态检查不能证明视觉一致、所有样式无引用或业务正确；必须结合浏览器和行为测试。不得通过ignore、移动目录、改名或删guard绕过规则。不为纯视觉数值编写镜像实现的测试；业务与可访问性回归用稳定的用户操作断言。

## 本轮审查记录

- 合并DESIGN中重复、互相覆盖的模型卡片、Header、上传编号、历史重试、弹窗规则；当前UI固定，不更换主题或尺寸。
- GenerationHistory保留历史查询与预览编排；抽出HistoryTaskMeta、ResultImage、HistoryIndex和共享状态，移除原重复定义。
- 预览与资产管理直接复用共享中心开关hook，移除仅转发导出的文件。
- 移除无调用方的旧showcase数据、专属样式和六段未挂载视频；保留仍在用的样例图片、模型封面、设计证据与用户本地文件。
- 运行结果与局限以本次交付记录为准，本文不保留易过期的通过数量或旧版尺寸对比表。
