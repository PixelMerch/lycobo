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
`apps/web/public/studio` 下的样例图由内置 image_gen 生成，不代表真实客户商品或生成结果；家纺裂变视角示例见[视角示例](textile-view-examples.md)。参考站研究不构成品牌素材授权。

## React Bits Silk

首页首屏的丝绸背景改编自 [React Bits Silk](https://reactbits.dev/backgrounds/silk)，来源 [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits/tree/ed33ebe4acfe29e60fb759bcccc70a138ce2dcef/src/ts-default/Backgrounds/Silk)，固定 commit `ed33ebe4acfe29e60fb759bcccc70a138ce2dcef`。代码位于 `apps/web/src/features/home/silk/`：着色器算法保留原样，只去掉浅色模式、边缘渐隐与随机偏移；组件按本仓库规则重写为着色器、渲染器、动画状态与组件四个模块，去掉类型断言，增加配色平滑过渡、页签切换涟漪、每次挂载新建画布（避免复用已释放的 WebGL 上下文）与像素比上限，未增加第三方运行时依赖。

上游采用 MIT + Commons Clause，版权 David Haz (2026)。完整许可保留在 [React Bits 许可](licenses/react-bits.md)：允许作为应用、网站或产品的一部分使用，不允许出售或重新分发组件本身／组件包。本站仅将其用于首页背景，不提供 React Bits 组件或工具分发服务。
