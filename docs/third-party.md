# 第三方材料

项目代码当前为 private，未声明开源授权。第三方依赖保留各自 license，
正式分发前由项目所有者决定自身许可并检查依赖授权。

项目技能：
- vercel-labs/agent-skills / react-best-practices：SKILL.md 标注 MIT；
  固定快照未找到独立 LICENSE 文件，保留其原始 metadata、来源与 commit。
- openai/skills / security-best-practices：保留技能自带 LICENSE.txt，
  同时归档至 .agents/licenses/security-best-practices.txt。
- supabase/agent-skills：保留上游 LICENSE 至 .agents/licenses/supabase-postgres-best-practices.txt。
- heroui-inc/heroui / react 技能：Apache License 2.0，保留技能自带 LICENSE.txt，
  同时归档至 .agents/licenses/heroui-react.txt。

来源和准确 SHA 见 .agents/skills-lock.json，未经审查不变更原始材料。
docs/design 的参考站交互研究不构成品牌素材授权；实际示例素材的生成来源单独记录，不冒充真实客户案例。

## React Bits 视觉效果

首页图片背景参考[React Bits Grid Motion](https://www.reactbits.dev/backgrounds/grid-motion)的倾斜图片墙与交替漂移，来源[DavidHDev/react-bits](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Backgrounds/GridMotion)，核对commit `4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4`。本地适配在`apps/web/src/features/home/home-grid-motion.tsx`及同名CSS中：保留上游行数、比例、间隔、圆角、角度、倾斜、速度、方向、鼠标视差、提亮、暗化、渐隐和灰度参数；限定为本站已有商品示例并铺在首页创作区后方，不提供编辑工具。适配严格索引检查、稳定节点key、页面隐藏暂停、动态减少运动偏好，以及顶部不渐隐以覆盖Header。所有页面参数由`react-bit-config.ts`提供。按需加载，无新增运行时依赖。首页旧Dot Grid与Rotating Text已移除，不影响图片详情的独立点阵实现。

上游采用MIT + Commons Clause，版权David Haz（2026）。完整许可保留在[React Bits许可](licenses/react-bits.md)：允许作为应用、网站或产品的一部分使用，不允许出售或重新分发组件本身／组件包。本站仅将其用于首页视觉，不提供React Bits组件或工具分发服务。图片为本站已有本地AI示例，来源说明仍由各示例文档维护。
