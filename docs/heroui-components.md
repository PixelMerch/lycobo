# Web 组件与字体

本文件记录 `@heroui/react` 3.2.7 实际导出的组件能力，供实现前查阅。
规则只有一条：**交互能力在下面的清单里已经存在时，直接组合官方组件，不要自己实现。**
CSS 负责主题与尺寸，约定见 [Web 规则](../apps/web/AGENTS.md)。

清单由 `apps/web/node_modules/@heroui/react/dist/components` 的实际目录整理，
不是上游文档的推测。升级 `@heroui/react` 后必须重新核对本文件。

## 操作与按钮

| 组件                | 用途                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `Button`            | 唯一的按钮基础件，`variant`/`size`/`isIconOnly`/`isDisabled`/`onPress` |
| `ButtonGroup`       | 相邻按钮的组合外壳                                                     |
| `ToggleButton`      | 单选或开关式按钮，选中态经 `data-selected` 暴露                        |
| `ToggleButtonGroup` | 互斥单选／多选的按钮组，`selectionMode`、`disallowEmptySelection`      |
| `CloseButton`       | 弹层、标签等关闭入口                                                   |
| `Toolbar`           | 一组操作的工具条语义                                                   |

参数互斥选项（分辨率、张数、图片比例）必须用 `ToggleButtonGroup` + `ToggleButton`，
不要用 `Button` 配 `aria-pressed` 手写单选。

单行参数使用弹簧滑动底板时，在按钮之后追加 [SelectionPill](../apps/web/src/components/selection-pill.tsx)，传入当前选中的 `value`。按钮组负责值和键盘交互，组件统一管理选中底色和弹簧，底板按选中按钮的尺寸与圆角绘制。禁用值隐藏底板。

## 输入与表单

| 组件                                                                                                                 | 用途                       |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `TextField` / `Input` / `TextArea`                                                                                   | 文本、多行文本与字段组合   |
| `Label` / `Description` / `FieldError` / `ErrorMessage`                                                              | 字段标签、说明与校验信息   |
| `Fieldset`                                                                                                           | 字段分组                   |
| `Form`                                                                                                               | 官方表单提交与校验串联     |
| `NumberField` / `SearchField` / `InputOTP`                                                                           | 数字、搜索、验证码输入     |
| `InputGroup`                                                                                                         | 输入框内前置／后置附加内容 |
| `Checkbox` / `CheckboxGroup`                                                                                         | 复选                       |
| `Radio` / `RadioGroup`                                                                                               | 单选                       |
| `Switch` / `SwitchGroup`                                                                                             | 开关                       |
| `Select` / `ComboBox` / `Autocomplete` / `ListBox`                                                                   | 下拉、可搜索选择与候选列表 |
| `Slider` / `Meter` / `ProgressBar` / `ProgressCircle`                                                                | 数值输入与进度             |
| `DateField` / `DatePicker` / `DateRangePicker` / `Calendar` / `RangeCalendar` / `CalendarYearPicker` / `TimeField`   | 日期与时间                 |
| `ColorField` / `ColorPicker` / `ColorArea` / `ColorSlider` / `ColorSwatch` / `ColorSwatchPicker` / `ColorInputGroup` | 颜色选择                   |

字段错误必须走 `FieldError` / `ErrorMessage`，不要另写 `<p role="alert">` 承担字段校验。

## 弹层与浮层

| 组件                                             | 用途                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Modal`                                          | 确认、说明；`Modal.Backdrop/Container/Dialog/Header/Heading/Body/Footer/CloseTrigger` |
| `Drawer`                                         | 移动导航及经确认的侧滑面板                                                            |
| `Popover`                                        | 小设置与说明面板，官方 Dialog 区域                                                    |
| `Tooltip`                                        | 辅助提示，不能承载唯一必要说明                                                        |
| `Dropdown` / `Menu` / `MenuItem` / `MenuSection` | 菜单与操作列表                                                                        |
| `AlertDialog`                                    | 需要显式确认的破坏性操作                                                              |
| `Disclosure` / `DisclosureGroup`                 | 手风琴式展开                                                                          |
| `Toast`                                          | 瞬时反馈                                                                              |

禁止手写焦点陷阱、模态键盘、下拉键盘或自建 dialog。

`Modal`、`AlertDialog` 和 `Drawer` 在关闭时立即移除内容和遮罩。全屏弹窗共用入场动效，关闭回调直接处理卸载或导航。

## 结构、导航与排版

| 组件                                          | 用途                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| `Card`                                        | 内容卡片外壳，`Card.Header/Title/Description/Content/Footer` |
| `Surface`                                     | 通用表面容器                                                 |
| `Tabs`                                        | 内容切换，需要 `Tabs.ListContainer` 才获得溢出滚动与渐隐     |
| `Accordion`                                   | 可折叠分组                                                   |
| `Breadcrumbs`                                 | 面包屑                                                       |
| `Link`                                        | 链接，可通过 `render` 接入 react-router                      |
| `Pagination`                                  | 分页                                                         |
| `Table`                                       | 表格                                                         |
| `Separator` / `Kbd` / `Header` / `Typography` | 分隔线、键帽、区块标题与排版                                 |
| `ScrollShadow`                                | 可滚动区域的边缘渐隐                                         |
| `Skeleton`                                    | 骨架加载                                                     |
| `EmptyState`                                  | 空状态容器                                                   |

导航、面包屑、图片下载链接等可点击文本使用 `Link`（配合
`apps/web/src/components/router-link.tsx` 保留路由），不要直接用裸 `<a>` 配样式类。

## 共享图片浏览

`apps/web/src/components/image-viewer/image-viewer.tsx` 导出 `ImageViewer` 与 `ViewerImage`。传入 `images: { src, alt }[]`、`initialIndex` 和 `onClose`，调用方保留缩略图入口并在打开前聚焦它。支持多图切换、左右旋转、按钮／滚轮缩放、放大拖动、Escape 与嵌套弹层焦点返回。历史记录及图片详情参考图通过 ReferenceThumbnails 按需加载此组件。使用共享图片浏览样式，只改变浏览状态。

## 状态与数据展示

| 组件                                  | 用途                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `Alert`                               | 区块级错误、警告与状态说明，`Alert.Content/Title/Description/Indicator` |
| `Badge` / `Chip` / `Tag` / `TagGroup` | 状态、标签与标记                                                        |
| `Avatar` / `AvatarGroup`              | 账户头像                                                                |
| `Spinner`                             | 加载中                                                                  |
| `EmptyState`                          | 无数据                                                                  |

反馈按职责选型，不把请求错误重复放进页面或弹窗：

| 场景                     | 统一入口                                           |
| ------------------------ | -------------------------------------------------- |
| API／网络请求失败        | `useErrorToast`，复用顶部 Toast 与去重逻辑         |
| 字段校验                 | `FieldError`／`ErrorMessage`，关联对应字段         |
| 确有必要的区块警告或说明 | `Alert`，不重复展示已发出的请求错误                |
| 无数据                   | `EmptyState`；表格使用官方 `Table.Body` 的空态插槽 |
| 正在请求                 | 对应控件的 pending／loading 状态，不伪造完成进度   |

不要用裸 `<p role="alert">` 或自建 `.empty-state` 重做组件已有的语义。

## 组合规则

- 组件用复合结构（`Card.Header`、`Modal.Dialog`），不要退化成大量自定义 props。
- 交互用 `onPress` 而不是 `onClick`；`onClick` 只保留给 router 的 `render` 透传。
- 语义 variant 优先（`primary`/`secondary`/`tertiary`/`danger`），不要写死颜色。
- 需要滚动容器的 `Tabs` 与内容溢出场景使用 `Tabs.ListContainer`、`ScrollShadow`。
- HeroUI 未提供的能力（文件选择、图形编辑）才允许使用原生元素，
  并且仍以 HeroUI `Button` 作为可见入口。

## 样式来源

账户焦点、登录玻璃和关闭按钮规格沿用既有组件及共享样式。

## 按钮统一入口与检查

按钮尺寸、内边距和圆角复用共享控件 token。
使用 Button 的 size="sm" / "md" / "lg" 与 isIconOnly，不以业务主色推断按钮一定需要更大 padding。
切换使用 ToggleButton／ToggleButtonGroup，导航当前项使用 aria-current。
`pnpm lint` 自动运行 AST 组件检查。

## 自托管字体

主站使用阿里巴巴普惠体 3.0，字体文件版本 3.01，来自[官方站点](https://www.alibabafonts.com/)。页面不向字体 CDN 发请求。字标仍是独立的 SVG 路径，不参与正文加载。

### 字重与加载

| 用途                         | 字重 | 官方文件    |
| ---------------------------- | ---- | ----------- |
| 正文、说明、用户输入         | 400  | 55 Regular  |
| 导航、按钮、字段标题         | 500  | 65 Medium   |
| 区块标题、当前导航、首页标语 | 600  | 75 SemiBold |
| 少量重点、会员价格           | 700  | 85 Bold     |

每个字重按固定字符分组生成 WOFF2：西文、界面常用字、其余字符。`unicode-range` 控制按需下载，`font-display: swap` 保留加载期间的系统字体。每个字重的切片互不重叠，覆盖对应官方源字体的全部 Unicode 映射；缺字继续使用系统字体回退，不把字体不支持的字符伪装成已覆盖。

字体在 `apps/web/public/fonts/alibaba-puhuiti-3`，声明在 `apps/web/src/styles/fonts`；内容哈希写入 WOFF2 文件名，`_headers` 对这些文件设置一年不可变缓存。CSS 随 Vite 打包并生成版本化文件名，不缓存可变名字的字体声明。没有全量字体或全部切片的 preload，浏览器只请求实际用到的字符和字重。

### 重新生成

生成不是开发启动、CI 或部署的前置步骤；提交的 WOFF2 可以直接构建发布。只有更新字体来源或分组时才重新生成。

1. 建立隔离 Python 环境，按 `scripts/fonts/requirements.txt` 安装固定版本工具。
2. 从官方源下载 `scripts/fonts/subsets.json` 中的四个 TTF，放到仓库外的同一临时目录。下载链接为 `https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/<不含扩展名的文件名>/<文件名>`；官方资源要求来自 `https://www.alibabafonts.com/` 的 Referer。原始文件不提交到仓库。
3. 在仓库外备份当前 `manifest.json` 后，运行 `python scripts/fonts/build-subsets.py --source-dir <临时字体目录>`。脚本先验证源文件 SHA256，再验证每个切片不丢字、分组不重叠、总覆盖完整；来源改变时校验失败，不静默采用新版。
4. 对照新旧 `manifest.json` 检查字符数、文件数和大小，只删除旧 manifest 中已经不再引用的哈希文件。运行 `pnpm exec biome check --write apps/web/src/styles/fonts scripts/fonts/subsets.json` 格式化生成的声明，用浏览器检查中英文及实际字体请求，执行 `pnpm check`。

`subsets.json` 的常用字分组来自当前界面文案频率，其他字符按码点划分。文案变化不会破坏覆盖或要求重新生成；它只可能让浏览器多下载一个已有切片。切片保留源字体版权和排版元数据，来源及授权链接见字体目录的 `NOTICE.txt`。

### 电商落地页隔离模板

首页落地页与主站统一使用普惠体。模板保持 sandbox 与禁止网络请求的 CSP，因此不能直接继承宿主页的字体声明。`scripts/fonts/embed-landing-fonts.py` 从已有 WOFF2 切片中提取落地页中英文文案源码字符的超集，保留字体名称与许可元数据，再以内联 data URI 写入模板；不修改主站原始切片或共享 token。

排版源为 `apps/web/src/features/home/landing/landing-typography.css`：Hero 与章节标题 600、导航和按钮及卡片标题 500、正文 400；新版首页 Hero 行高 1.08，按中英文和视口检查字距。SVG 字标保持原样。

修改落地页文案或排版源后，用安装了本目录固定字体依赖的隔离 Python 环境执行：

```sh
python scripts/fonts/embed-landing-fonts.py
```

只重建 `public/openart-reference/index.html` 中标记的字体块；脚本验证裁切后字形不丢失，保留页面布局与动画。随后检查中英文和手机显示，执行常规项目检查。该步骤仅在维护字体块时运行，不加入应用启动或部署流程。
