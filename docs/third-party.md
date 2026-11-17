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

登录页的丝绸背景改编自 [React Bits Silk](https://reactbits.dev/backgrounds/silk)，来源 [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits/tree/ed33ebe4acfe29e60fb759bcccc70a138ce2dcef/src/ts-default/Backgrounds/Silk)，固定 commit `ed33ebe4acfe29e60fb759bcccc70a138ce2dcef`。代码位于 `apps/web/src/features/home/silk/`：着色器算法保留原样，只去掉浅色模式、边缘渐隐与随机偏移；组件按本仓库规则重写为着色器、渲染器、动画状态与组件四个模块，去掉类型断言，增加配色平滑过渡、页签切换涟漪、每次挂载新建画布（避免复用已释放的 WebGL 上下文）与像素比上限，未增加第三方运行时依赖。

上游采用 MIT + Commons Clause，版权 David Haz (2026)。完整许可保留在 [React Bits 许可](licenses/react-bits.md)：允许作为应用、网站或产品的一部分使用，不允许出售或重新分发组件本身／组件包。本站仅将其用于首页背景，不提供 React Bits 组件或工具分发服务。

## OpenArt 页面参考

2026-11-16 用户提供本地 `page-take/recordings/openairt/source/`，并明确要求先完全复刻，再改为自己的品牌。`apps/web/public/openart-reference/index.html` 是从该录制文档生成的隔离参考稿，保留 OpenArt 的 HTML/CSS、导航与交互动效脚本及 Bricolage Grotesque/Inter 录制字体；照片与视频替换为灰阶占位。

快照只保留导航、Director 案例带、功能演示、FAQ 与主页动效脚本，剔除统计、广告、归因和远程加载器；禁止网络连接、表单提交与打开外部窗口。原站内容、模型、优惠和评价属于 OpenArt，不能转述为 Lycobo 的产品事实。没有声称原站代码或商标属于本项目，也未作公开发布。2026-11-17 按用户要求将文案与字标替换为 Lycobo：文案放入项目中英文目录，模板只保留内容键；原版客户标识、评价与星级不再呈现，原版字标路径改为本项目 SVG。布局及动画仍来自上述录制，不因品牌替换而改变来源；真实业务操作尚未接入。

用户明确批准 Biome 仅排除这一个生成 HTML；应用容器与其他代码不豁免。旧电商首屏的 Gradient Waves 组件随整页重做移除，React Bits Silk 仍用于其他页面，许可继续保留。

## 阿里巴巴普惠体 3.0

用户于2026-11-10确认主站中英文统一使用阿里巴巴普惠体3.0，替换思源黑体。官方字体文件版本3.01，使用55 Regular、65 Medium、75 SemiBold、85 Bold，对应400／500／600／700。源文件从[阿里巴巴字体官网](https://www.alibabafonts.com/)提供的字体地址获取，SHA256固定在 `scripts/fonts/subsets.json`；四个字重均保留源字体版权与排版元数据，转换为同源加载的字符切片WOFF2，不附带完整TTF，不依赖字体CDN。来源及[官方法律声明](https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy)见 `apps/web/public/fonts/alibaba-puhuiti-3/NOTICE.txt`，生成与验证见[字体维护](fonts.md)。

## Logo 图形与定制字标

2026-11-10 用户确认保留 A「显影」图形，采用独立几何绘制的工具风格字标，名称为 Lycobo，去掉探索稿的 AI 标签。c／o／b 共用圆角矩形构造；Logo 不再使用第三方字体轮廓，也不加载字体文件。正文仍使用上述普惠体自托管切片，相关字体来源与授权记录继续保留。
