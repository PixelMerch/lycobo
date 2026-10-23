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

## React Bits Dot Grid

首页装饰背景采用 [React Bits Dot Grid](https://reactbits.dev/backgrounds/dot-grid) 的 TypeScript/CSS 源码，来源 [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/DotGrid)，固定 commit `e12c22192ac7b4b452c5e2feb9b586d74765d696`。组件位于 `apps/web/src/features/home/dot-grid/`；本地修改包括严格类型、着色器资源清理、动态减少运动偏好及静态降级，未增加第三方运行时依赖。

上游采用 MIT + Commons Clause，版权 David Haz (2026)。完整许可保留在 [React Bits 许可](licenses/react-bits.md)：允许作为应用、网站或产品的一部分使用，不允许出售或重新分发组件本身／组件包。本站仅将其用于首页背景，不提供 React Bits 组件或工具分发服务。
