# UI 一致性与组件维护

以用户确认的定稿及后续整站排版校准为准；维护目标是保持现有 UI、消除重复实现、让规范与代码一致。视觉唯一来源为 [DESIGN.md](../DESIGN.md)，交互组件清单为 [HeroUI 组件清单](heroui-components.md)。不根据设计技能的通用推荐重新换色、改尺寸或重排页面。

## 组件分层

| 层次 | 职责 | 当前入口 |
| --- | --- | --- |
| 应用与页面 | 路由、布局、场景组合，不复制底层交互 | router、StudioShell、HomePage、WorkspacePage、AssetsPage |
| 功能组件 | 拥有一个完整功能及其局部交互 | ReferencePicker、HistoryTaskActions、LocalRepairPanel、AccountManagement、WalletPanel、LibraryDialog |
| 展示组件 | 明确输入和事件，不自行请求无关业务 | HistoryTaskMeta、ResultImage、CreationNavigation |
| 共享交互组合 | 组合 HeroUI，统一可复用的完整行为 | ConfirmDialog、DialogClose、ImageViewer、ReferencePrompt |
| 状态与同步 | 服务端数据用 TanStack Query，客户端草稿用 Zustand；hook只同步外部系统 | generation-client、wallet-client、studio-state、use-image-events |
| 视觉 | 全局token＋功能样式；不新增相互竞争的基础控件样式 | styles/app.css、components/*.css、features/**/*.css |

按功能边界拆分，不为了行数把静态片段变成几十个只有一个调用方的包装。反之，查询、任务元信息、图片操作、右侧索引、预览状态不应长期挤在一个页面组件里。跨功能使用共享组件的真实路径，不保留仅转发导出的兼容文件，也不建立全站 barrel。

## 已固定的共享能力

| 能力 | 唯一入口 | 维护约束 |
| --- | --- | --- |
| 工作区工具 | WorkspaceToolPicker | 四个工具的工具坞，点击直接切换，保持各工具草稿；家纺裂变使用共享上传预览／比例，复用真实生成提交、历史、索引与逐图状态，视角预设由服务端管理 |
| 账户入口 | HeaderLogin + HeaderBenefits + AccountMenu | 未登录入口在Header，已登录账户在侧栏底部；共用账户查询，余额在菜单内和Header；积分点击展开真实概览、悬停不打开，会员打开当前页弹窗，更新与消息使用HeroUI右侧抽屉；应用壳不复制状态 |
| 账户内容 | AccountPanel → AccountManagement / WalletPanel → BillingRecords；CreditsDialog / MembershipPage | 按入口分别打开；会员全屏订阅弹窗、充值720px独立弹窗，个人及管理弹层自然高度；真实账号与账单来自查询客户端，未接入的绑定／重置／支付不模拟成功 |
| 确认 | ConfirmDialog | 不在业务中复制 Modal 标记；正文与操作布局共用 |
| 关闭 | HeroUI CloseTrigger + DialogClose | 全局--dismiss-*统一普通Modal／Drawer／AlertDialog的命中区和hover圆盘；全屏使用DialogClose具名大尺寸，业务只负责定位 |
| 长文本折叠 | CollapsibleText | 历史提示词与详情创意描述共用实际溢出测量、展开／收起及 aria 状态；详情3行，历史保留既有行数，短文本不显示切换按钮 |
| 参考图片上传 | ReferencePicker → ReferenceImageCard | 首页与工作台共用；删除、编号、预览不复制 |
| 图片引用 | ReferencePrompt | 文本序列化、@候选、行内图片展示共用 |
| 列表分页 | InfiniteLoad | 滚动到列表底部自动取下一页；使用 HeroUI Spinner 显示加载，禁止另加“加载更多”按钮；失败停止自动加载，查询和重试由业务持有 |
| 参考图片浏览 | ImageViewer | 历史、详情、上传入口按需加载同一组件 |
| 生成图片操作 | ResultImage | 预览、下载、收藏、焦点入口由同一组件承担 |
| 任务元信息 | HistoryTaskMeta | 标签、时间、比例、任务ID复制一致；父级用 modelDisplayName 从共享模型目录派生展示名称，不渲染原始 model 标识 |
| 历史索引 | HistoryIndex | 定位与滚动同步；“我的素材”标题固定、列表独立滚动；不承担重试或草稿覆盖 |
| 生成提交按钮 | HeroUI Button + styles/studio-workspace-form.css 的 .generation-submit | 工作台与局部修改高度、胶囊圆角、青柠至薄荷绿渐变与深色前景、字级及积分间距统一引用 DESIGN；不创建按钮包装组件 |
| 生成阶段 | generation-status | 中文状态与生成图标共用，不从颜色推断状态 |
| 全屏开关动画 | components/use-centered-dialog-motion | 关闭动画结束后卸载；不复制 hook |
| 请求错误 | useErrorToast | 去重、统一顶部反馈；字段校验继续用 FieldError／ErrorMessage |

纯展示组件不增加另一份服务端状态；在父级派生数据，通过props传递。Zustand订阅选择所需字段，不用effect维持可在render计算的冗余状态。支付、鉴权、计费和任务快照不属于视觉重构范围。

## 设计与代码清理流程

1. 先读用户最新要求、Git状态、PRD、DESIGN和组件清单，标出已有未提交工作。维护性重构保留现行视觉；用户明确要求的视觉调整须同步修改DESIGN中的现行规则。
2. 用UI/UX Pro Max核对层级、状态反馈、触屏和响应式；用React技能核对状态与组件边界。研究结果与用户定稿冲突时保留定稿，不生成另一份MASTER规范。
3. 核对安装的HeroUI API，再组合官方组件。选Button size、variant、isIconOnly，选择控件用ToggleButtonGroup / Select，不手写aria-pressed单选、菜单键盘或焦点陷阱。
4. 拆分时保留DOM语义、class、事件、焦点恢复和计费边界。先移功能单元，再删旧定义和转发；不顺便升级依赖、技能、主题token。
5. 删除代码前检查导入、动态字符串路径、CSS类、文档、测试与素材清单。无静态import不能单独证明public资源无用；成套删除已停用数据、专属样式和资源，并同步索引。
6. 对仍在运行的UI检查桌面与窄屏、长文案、禁用、键盘焦点、加载和嵌套关闭。浏览器实测与自动化fixture各有边界，不能把fixture成功当成真实渠道验收。
7. 本地执行 `pnpm check`、`git diff --check`；关键交互按需运行相关 E2E，不默认运行本地全量。获授权推送后由远程CI执行Quality与Infrastructure；全量E2E仅手动触发，必需检查成功后才能合并，详见[测试说明](testing.md)。发现失败查清原因，记录实际结果；只提交任务相关路径，不夹带本地技能或工具目录。

## 自动约束与覆盖边界

pnpm lint运行`scripts/check-ui-conventions.mjs`，以TypeScript AST识别组件导入别名，拒绝：

- 裸button/input/select/textarea/a及原生元素伪装的交互role。
- Radix、Headless UI、直接React Aria基础件等第二套primitives。
- HeroUI Button/ToggleButton使用onClick或手写aria-pressed。
- Button/ToggleButton中的内联尺寸、padding、radius。

原生隐藏file input是文件选择的具名例外，可见入口仍为HeroUI Button。路由适配使用RouterLink，不重做链接键盘。图形编辑等HeroUI没有覆盖的领域按项目已有canvas组件执行。

静态检查不能证明视觉一致、所有样式无引用或业务正确；必须结合浏览器和行为测试。不得通过ignore、移动目录、改名或删guard绕过规则。不为纯视觉数值编写镜像实现的测试；业务与可访问性回归用稳定的用户操作断言。

## 一致性审查清单

| 审查面 | 应检查的现状 | 不应通过“统一”引入的变化 |
| --- | --- | --- |
| 视觉 | 同类控件使用同一 token、字级、间距和状态；具名例外有明确范围 | 扩散登录浅色、账户焦点或参考站配色 |
| 组件 | 页面组合完整功能组件，通用交互通过 HeroUI 和既有共享入口复用 | 第二套按钮、弹窗、焦点陷阱或无意义包装层 |
| 内容 | 简体中文；任务 ID 与图片 ID 分开；素材来源与媒体类型分开 | 改名后误称视频／音频已经可生成 |
| 状态 | 区分加载、失败、空态、禁用与成功；错误去重 | 内存成功、虚构余额、验证码倒计时或退款承诺 |
| 草稿 | 页面、模型、历史与预览的切换遵守已有草稿和定位行为 | 后台完成自动跳页、样式重构顺便清空输入 |
| 可访问性 | 键盘焦点可见、图标有名称、关闭后恢复焦点、减少动态效果生效 | 把“无主题色边框”改成所有控件都没有焦点提示 |
| 响应式 | 主要操作可达，弹窗不超出视口，只有具名容器内部滚动 | 用缩小字体或隐藏内容掩盖溢出 |

## 整站视觉覆盖核对

样式统一应同时检查首页、主图制作、家纺裂变、套图计划、视频创作、历史记录、素材库、详情与局部编辑、登录、账户账单、右侧更新和消息。仅修改root变量不能证明页面局部覆盖已经统一；同时检查功能CSS中的字号、行高、分组间距、hover和移动端覆盖。

- 排版按DESIGN的12/13/14/16/18/24px语义字级成对使用行高；不能把辅助角标的小字扩散到正文。手机可编辑字段至少16px。
- 内容间距复用 `--space-*`，保留图片、画布、轨道和导航的具名几何；不以缩小图片或触控区实现紧凑。
- hover复用 `--interaction-*` 与 `--control-*-fill`，检查常态到hover仍有可见反馈，不能因共用色让同底控件失去状态差异。品牌、危险、登录浅色和图片舞台保留语义例外。
- 鼠标hover不改变尺寸和位置；键盘焦点仍可见，点击后的程序化焦点不出现多余整块外框；抽屉与图片动效继续验证减少动态效果。
- 用实际页面核对阅读密度，用带明确fixture来源的针对性E2E核对草稿、焦点、窄屏、展开收起、计划和编辑操作；不为CSS数值编写镜像测试，也不把fixture通过视为生产生图验收。

## 文档与交付

- 产品术语与范围更新 PRD；视觉参数更新 DESIGN；组件能力更新组件清单；职责与路径更新 PROJECT_STRUCTURE。
- 实施文档记录当前数据来源、能力和限制，不复制颜色、尺寸表。
- 删除文件或素材时同步更新索引和引用，不把用户本地文件当作废弃资源。
- 交付记录说明改动、执行的检查和未验证边界，不在规范中累计日期覆盖条款、过期截图或测试通过数量。
- 纯文档整理检查链接、术语、代码依据和 `git diff --check`；只有改变代码／UI 时才按仓库要求运行相应工程和浏览器检查，不把文档修正称为页面已改版。
