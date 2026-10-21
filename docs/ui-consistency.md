# 全站 UI 一致性与维护流程

更新：2026-10-20。适用当前 React/Vite 工作台，HeroUI 3.2.6。尺寸数值唯一来源为 [DESIGN.md 第 6 节](../DESIGN.md)，组件选择唯一清单为 [HeroUI 组件清单](heroui-components.md)。本文记录审查发现与工作流程，不再定义第三套视觉标准。

## 本次审查范围与修复

| 范围 | 发现 | 落实 |
| --- | --- | --- |
| 全站 Button | 统一 40px min-height 会撑大已设置为 32px 的控件；基础 height 与 min-height 冲突 | 统一 sm／md／lg 档位，移除这个全局最小高度，具名例外保留 |
| 主按钮与弹窗操作 | 主按钮叠加 24px 横向 padding，与相邻次按钮不一致 | 主次操作默认同档；统一 12px 横向 padding，只有 lg 为 16px |
| Header 登录领积分 | height 为 32px，但被全局 min-height 撑到 40px | 桌面恢复 32px，左右 12px，白底黑字胶囊保留 |
| 工具栏、素材库、案例 | 小按钮使用 4px × 12px 的独立规则 | 改用官方 size="sm" / variant="outline"：32px 高、垂直 0、左右 8px，删除独立 small-button 尺寸 class |
| 图标与触屏 | 内边距、命中区与图标大小混在一起 | isIconOnly 对应 size 的正方形；图标继续使用 UiIcon；窄屏／粗指针至少 44px，上传删除透明命中区保留 |
| 首页／模型选择／案例 | 卡片也可能由 Button 承载，不能全局压成普通按钮 | 保留封面、正文驱动的卡片布局，不因普通按钮收紧而裁切卡片 |
| 工作台参数、模型下拉、登录 | 已使用 HeroUI ToggleButtonGroup／Select／TextField／InputGroup | 延续官方组合，不另写互斥选择、输入框或焦点逻辑 |
| 图片结果 | 查看原图仍使用裸 a，收藏手写 Button pressed 状态 | 替换为 HeroUI Link、ToggleButton；图片链接显式 width:100%，避免默认 fit-content 改变 400px 预览尺寸 |
| 当前模型与历史索引 | 用 aria-pressed 表示当前导航记录 | 使用 aria-current，不伪装成可取消的开关 |
| 过期样式 | 已移除任务中心、旧头像和 neutral-button 仍留有几何规则 | 清理无使用方的旧规则，避免后续复制旧尺寸 |
| 维护机制 | 只有文档约定，新增代码仍可能重新使用原生控件 | 将 AST 组件边界检查接入 pnpm lint，并增加正反例单元验证 |

保留的业务例外包括侧栏导航、比例图案选项、图片卡片、上传删除角标、图片悬浮动作、历史索引、登录与生成提交动作以及回到顶部。其尺寸理由见 DESIGN.md，不能把例外复制成新的默认按钮。

## 错误反馈规则

- 请求类错误（进入会话、模型目录、生成记录、素材列表、提交任务）只在页面顶部弹出一次 danger toast，不在页面、参数面板或结果区内渲染常驻错误文案。
- 页面内不再提供“重新连接”按钮：同一错误消息在查询保持错误态期间不重复弹出，恢复后再次失败才重新提示。
- 任务级结果仍以服务端状态为准：失败图片占位、待确认提交使用生成按钮文案“确认上次提交”表达，不伪造进度或成功。
- 字段级校验（上传格式、大小、必填）继续使用字段下方的 `Alert`／`FieldError`，属于输入校验而非请求错误。
- 统一使用 `useErrorToast`（apps/web/src/lib/error-toast.ts）实现去重与 toast 提示，不各页手写 `useRef` 去重逻辑。

## 浏览器实测记录

1440px 桌面视口，对同一页面修改前后读取 getBoundingClientRect 与 computed padding：

| 控件 | 修改前实际高度／左右 padding | 修改后实际高度／左右 padding |
| --- | --- | --- |
| Header 登录领积分 | 40px / 16px | 32px / 12px |
| 首页开始创作 | 40px / 24px | 36px / 12px |
| 工作台立即生成 | 44px / 24px | 44px / 12px |

保留登录白底黑字、导航 40px 行高、图片卡片封面比例；不是把所有内容压缩成同样的小按钮。

## 所有 AI 与贡献者的执行顺序

1. 开始前读取 AGENTS.md、DESIGN.md、docs/heroui-components.md；检查 Git 状态并保留已有改动。
2. 在组件清单里找到对应能力，按 `.agents/skills/heroui-react/SKILL.md` 查已安装版本的官方文档。HeroUI 有组件就组合它，不写新的基础按钮、输入、弹窗、单选、菜单、Tooltip 或焦点陷阱。
3. 按需求选择 Button 的 size、variant、isIconOnly。表单、导航、切换分别使用对应官方组件，不用 aria 属性手工重建已有交互。
4. 视觉只引用共享 token。需要新例外时，先在 DESIGN.md 写清场景、尺寸与移动端规则，再用具名功能 class；不内联 padding／height／radius，不新增互相竞争的通用 `.compact-button` 等尺寸体系。
5. 检查桌面、窄屏、长文案、禁用、键盘聚焦、按压和加载状态。收紧 padding 不得缩小手机命中区，不得通过删除焦点解决边框问题。
6. 运行 pnpm check、UI 变更运行 pnpm test:e2e，并检查 git diff --check。记录实际执行结果、例外和未接入能力。

## 自动检查覆盖与边界

`scripts/check-ui-conventions.mjs` 使用项目已有 TypeScript AST 解析 TSX，识别 HeroUI 导入别名，不靠 JSX 字符串搜索判断。

它拒绝：裸 button/input/select/textarea/a；原生元素加 dialog/button/radio 等交互 role；直接引入 Radix、Headless UI 或 React Aria Components；HeroUI Button/ToggleButton 使用 onClick；Button 手写 aria-pressed；Button/ToggleButton 内联几何属性。

唯一原生控件例外为 `type="file"` 且带 visually-hidden／sr-only 的 input：浏览器文件选择没有对应 HeroUI 组件，可见入口仍必须用 HeroUI Button。路由适配使用 components/router-link.tsx 中官方 Link 的 render 能力，不重新实现点击或键盘。

自动检查不能判断页面是否好看，也不能覆盖所有动态样式与业务流程；它与浏览器检查、组件测试共同使用。不得通过 eslint/biome ignore、移出目录、删除 guard 或改名来绕开规则。新增依赖、版本、基础 token 和例外都需要明确审查，不顺便升级框架或 skills。

## 技能的职责

- `heroui-react`：组件组合、props、状态与已安装版本 API。
- `vercel-react-best-practices`：React 状态、渲染与加载质量；不引入 Next.js 特有实现。
- `refero-design`：参考研究和视觉核对；当前密度方向来自用户提供的艺栢、小云雀截图及本站已确认设计，DESIGN.md 继续拥有最终视觉决定权。

新增设计技能必须沿用这些边界，不得建立另一套品牌、按钮尺寸或交互基础件。不同 AI 使用同一套文档、组件和 lint 检查，才能让规范持续生效。
