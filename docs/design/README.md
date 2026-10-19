# 设计规范与交互研究

[DESIGN.md](../../DESIGN.md) 是唯一视觉规范：HeroUI v3、深色中性表面、#BAA4FF → #8B5CF6 紫色渐变、统一字体／边框／圆角。

## 当前材料

- [图片创作三步 UI](image-creation-flow.md)：完整首页 → 两模型选择层 → GPT Image 三栏工作台；本轮图片创作评审目标。
- [当前导航与 TK 专区 UI 图](navigation-and-tk.md)：AI 电商工具选择层 V3（主内容 padding 对齐、外围纯黑）、TK 自动发布；当前信息架构以此及 PRD 为准。
- [紫色工作台首轮探索](purple-studio-mockups.md)：保留三栏布局探索，家纺工具的导航归属已由当前方案更正。
- [艺栢页面与操作逻辑研究](yibai-page-logic.md)：分类展开、功能选择层、画图三栏、案例回填和历史联动；区分实测、代码与未验证行为。
- [当前家纺素材提示词](studio-photo-prompts.json)：三组独立商品照片的来源；旧四宫格素材已从应用删除。

旧版 UI 截图和风格提取文档已删除；不能用现有预览代码代替新规范的视觉验收。新 UI 图是布局与视觉目标，具体 token、组件和交互需在实现中验证。

当前页面已实现，草稿、收藏及最近使用为会话内状态；生成历史与任务中心为空，没有模拟生成。具体范围见 [实现与验收](../image-studio-implementation.md)。
