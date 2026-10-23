# HeroUI 组件清单（已安装版本）

本文件记录 `@heroui/react` 3.2.6 实际导出的组件能力，供实现前查阅。
规则只有一条：**交互能力在下面的清单里已经存在时，直接组合官方组件，不要自己实现。**
CSS 仍负责主题与尺寸，见 [DESIGN.md](../DESIGN.md)。

清单由 `apps/web/node_modules/@heroui/react/dist/components` 的实际目录整理，
不是上游文档的推测。升级 `@heroui/react` 后必须重新核对本文件。

## 操作与按钮

| 组件 | 用途 |
| --- | --- |
| `Button` | 唯一的按钮基础件，`variant`/`size`/`isIconOnly`/`isDisabled`/`onPress` |
| `ButtonGroup` | 相邻按钮的组合外壳 |
| `ToggleButton` | 单选或开关式按钮，选中态经 `data-selected` 暴露 |
| `ToggleButtonGroup` | 互斥单选／多选的按钮组，`selectionMode`、`disallowEmptySelection` |
| `CloseButton` | 弹层、标签等关闭入口 |
| `Toolbar` | 一组操作的工具条语义 |

参数互斥选项（分辨率、张数、图片比例）必须用 `ToggleButtonGroup` + `ToggleButton`，
不要用 `Button` 配 `aria-pressed` 手写单选。

## 输入与表单

| 组件 | 用途 |
| --- | --- |
| `TextField` / `Input` / `TextArea` | 文本、多行文本与字段组合 |
| `Label` / `Description` / `FieldError` / `ErrorMessage` | 字段标签、说明与校验信息 |
| `Fieldset` | 字段分组 |
| `Form` | 官方表单提交与校验串联 |
| `NumberField` / `SearchField` / `InputOTP` | 数字、搜索、验证码输入 |
| `InputGroup` | 输入框内前置／后置附加内容 |
| `Checkbox` / `CheckboxGroup` | 复选 |
| `Radio` / `RadioGroup` | 单选 |
| `Switch` / `SwitchGroup` | 开关 |
| `Select` / `ComboBox` / `Autocomplete` / `ListBox` | 下拉、可搜索选择与候选列表 |
| `Slider` / `Meter` / `ProgressBar` / `ProgressCircle` | 数值输入与进度 |
| `DateField` / `DatePicker` / `DateRangePicker` / `Calendar` / `RangeCalendar` / `CalendarYearPicker` / `TimeField` | 日期与时间 |
| `ColorField` / `ColorPicker` / `ColorArea` / `ColorSlider` / `ColorSwatch` / `ColorSwatchPicker` / `ColorInputGroup` | 颜色选择 |

字段错误必须走 `FieldError` / `ErrorMessage`，不要另写 `<p role="alert">` 承担字段校验。

## 弹层与浮层

| 组件 | 用途 |
| --- | --- |
| `Modal` | 确认、说明、工具选择层；`Modal.Backdrop/Container/Dialog/Header/Heading/Body/Footer/CloseTrigger` |
| `Drawer` | 移动导航及经确认的侧滑面板 |
| `Popover` | 小设置与说明面板，官方 Dialog 区域 |
| `Tooltip` | 辅助提示，不能承载唯一必要说明 |
| `Dropdown` / `Menu` / `MenuItem` / `MenuSection` | 菜单与操作列表 |
| `AlertDialog` | 需要显式确认的破坏性操作 |
| `Disclosure` / `DisclosureGroup` | 手风琴式展开 |
| `Toast` | 瞬时反馈 |

禁止手写焦点陷阱、模态键盘、下拉键盘或自建 dialog。

## 结构、导航与排版

| 组件 | 用途 |
| --- | --- |
| `Card` | 内容卡片外壳，`Card.Header/Title/Description/Content/Footer` |
| `Surface` | 通用表面容器 |
| `Tabs` | 内容切换，需要 `Tabs.ListContainer` 才获得溢出滚动与渐隐 |
| `Accordion` | 可折叠分组 |
| `Breadcrumbs` | 面包屑 |
| `Link` | 链接，可通过 `render` 接入 react-router |
| `Pagination` | 分页 |
| `Table` | 表格 |
| `Separator` / `Kbd` / `Header` / `Typography` | 分隔线、键帽、区块标题与排版 |
| `ScrollShadow` | 可滚动区域的边缘渐隐 |
| `Skeleton` | 骨架加载 |
| `EmptyState` | 空状态容器 |

导航、面包屑、图片下载链接等可点击文本使用 `Link`（配合
`apps/web/src/components/router-link.tsx` 保留路由），不要直接用裸 `<a>` 配样式类。

## 共享图片浏览

`apps/web/src/components/image-viewer.tsx` 导出 `ImageViewer` 与 `ViewerImage`。传入 `images: { src, alt }[]`、`initialIndex` 和 `onClose`，调用方保留缩略图入口并在打开前聚焦它。支持多图切换、左右旋转、按钮／滚轮缩放、放大拖动、Escape 与嵌套弹层焦点返回。历史记录及图片详情参考图通过 ReferenceThumbnails 按需加载此组件。尺寸与视觉遵循 DESIGN.md 的通用图片浏览章节；只改变浏览状态，不写回素材。

## 状态与数据展示

| 组件 | 用途 |
| --- | --- |
| `Alert` | 区块级错误、警告与状态说明，`Alert.Content/Title/Description/Indicator` |
| `Badge` / `Chip` / `Tag` / `TagGroup` | 状态、标签与标记 |
| `Avatar` / `AvatarGroup` | 账户头像 |
| `Spinner` | 加载中 |
| `EmptyState` | 无数据 |

反馈按职责选型，不把请求错误重复放进页面或弹窗：

| 场景 | 统一入口 |
| --- | --- |
| API／网络请求失败 | `useErrorToast`，复用顶部 Toast 与去重逻辑 |
| 字段校验 | `FieldError`／`ErrorMessage`，关联对应字段 |
| 确有必要的区块警告或说明 | `Alert`，不重复展示已发出的请求错误 |
| 无数据 | `EmptyState`；表格使用官方 `Table.Body` 的空态插槽 |
| 正在请求 | 对应控件的 pending／loading 状态，不伪造完成进度 |

不要用裸 `<p role="alert">` 或自建 `.empty-state` 重做组件已有的语义。

## 组合规则

- 组件用复合结构（`Card.Header`、`Modal.Dialog`），不要退化成大量自定义 props。
- 交互用 `onPress` 而不是 `onClick`；`onClick` 只保留给 router 的 `render` 透传。
- 语义 variant 优先（`primary`/`secondary`/`tertiary`/`danger`），不要写死颜色。
- 需要滚动容器的 `Tabs` 与内容溢出场景使用 `Tabs.ListContainer`、`ScrollShadow`。
- HeroUI 未提供的能力（文件选择、图形编辑）才允许使用原生元素，
  并且仍以 HeroUI `Button` 作为可见入口。

## 与 DESIGN.md 的关系

包括账户表单的中性焦点、登录浅色表面和不同关闭规格在内，所有局部视觉规则只在 DESIGN.md 维护。
DESIGN.md 决定视觉与几何，本文件决定“用什么组件”与“不要自己实现什么”。
两者冲突时以 DESIGN.md 的视觉规范为准，但不得据此重新手写交互组件。

## 按钮统一入口与检查

按钮档位、padding、圆角的唯一数值表在 [DESIGN.md 的基础控件规范](../DESIGN.md#3-排版图标与基础控件)；不要在本文件另建一套数值。
使用 Button 的 size="sm" / "md" / "lg" 与 isIconOnly，不以业务主色推断按钮一定需要更大 padding。
切换使用 ToggleButton／ToggleButtonGroup，导航当前项使用 aria-current。
审查步骤见 [UI 一致性维护](ui-consistency.md)，pnpm lint 自动运行 AST 组件检查。
