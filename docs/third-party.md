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
`apps/web/public/studio` 下的样例图由内置 image_gen 生成，不代表真实客户商品或生成结果。参考站研究不构成品牌素材授权。

页脚的社媒图标取自项目已安装的 Tabler Icons 3.51.0。MIT 许可原文随 [SVG](../apps/web/public/brand/lycobo-footer-socials.svg) 保留。

全局加载动画使用 [react-spinners](https://github.com/davidhu2000/react-spinners) 0.17.1 的 `HashLoader`，依赖遵循 MIT 许可。

## React Bits Silk

登录页背景的着色器来自 [React Bits Silk](https://github.com/DavidHDev/react-bits/tree/ed33ebe4acfe29e60fb759bcccc70a138ce2dcef/src/ts-default/Backgrounds/Silk)，实现位于 `apps/web/src/features/auth/silk/`。使用 MIT + Commons Clause，保留 David Haz (2026) 的版权及[许可原文](#react-bits-许可原文)。

## DesignBookmark Command button

灵感库的搜索按钮使用 [DesignBookmark Command button](https://designbookmark.com/motion-src/react/command-button.tsx) 标注为 MIT 的动效参数。组件位于 `apps/web/src/components/command-button.tsx`，使用项目控件和文案重新实现。

## OpenArt 页面参考

`apps/web/public/openart-reference/index.html` 源于本地 `page-take/recordings/openairt/source/` 的 OpenArt 录制。模板仍含该来源的导航、布局和交互动效。Lycobo 的文案、品牌与自托管字体在项目内维护。原站素材、模型、统计、评价及商标不可用于 Lycobo 宣传。模板以 sandbox 和 CSP 隔离，禁止远程加载、表单提交和打开外部窗口。已批准的 Biome 例外仅适用于这份生成 HTML。

## 阿里巴巴普惠体 3.0

用户于2026-11-10确认主站中英文统一使用阿里巴巴普惠体3.0，替换思源黑体。官方字体文件版本3.01，使用55 Regular、65 Medium、75 SemiBold、85 Bold，对应400／500／600／700。源文件从[阿里巴巴字体官网](https://www.alibabafonts.com/)提供的字体地址获取，SHA256固定在 `scripts/fonts/subsets.json`；四个字重均保留源字体版权与排版元数据，转换为同源加载的字符切片WOFF2，不附带完整TTF，不依赖字体CDN。来源及[官方法律声明](https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy)见 `apps/web/public/fonts/alibaba-puhuiti-3/NOTICE.txt`，生成与验证见[字体维护](heroui-components.md#自托管字体)。

## Logo 图形与定制字标

Lycobo 使用由 C 形与圆点组成的图形标志和独立绘制的几何字标。c／o／b 共用圆角矩形构造。登录页、浏览器图标、安装图标与通知图标使用同一 C 形标志。Logo 使用自有向量轮廓，正文使用上述普惠体自托管切片。已发出的验证码邮件使用的旧图片地址由静态资源规则返回新图标。

## React Bits 许可原文

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
