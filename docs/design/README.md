# 设计资料索引

唯一视觉规范是 [DESIGN.md](../../DESIGN.md)，产品范围是 [PRD.md](../../PRD.md)。本目录保存品牌定稿，以及可复用的候选素材。

- [Lycobo Logo 定稿](brand/lycobo-reveal-approved.png)：2026-11-10 确认的 A「显影」方案，相对的取景边角、斜向留白及直接绘制的 Lycobo 工具风格字标，不附 AI 标签；图中的网站区域是静态应用示意。正式资源为 `apps/web/public/brand/lycobo-reveal*`，配色与使用规则见 DESIGN.md。
- [首页蓝色床品素材总览](home-lycobo-assets/blue-quilt-contact-sheet.jpg)：独立生成的备选样图，当前页面未接入。
- [首屏蓝被原图与卖点图](home-lycobo-assets/blue-quilt-product-pair.jpg)：备选原图与成片，另有[扫线动画预览](home-lycobo-assets/blue-quilt-product-reveal.gif)。

参考站实测和交互研究的结论已写入 DESIGN.md，已实现的设计图不再保留，需要时从 Git 历史找回。不要重新以静态图维护第二份产品规范。新增参考只保留支撑当前决策的必要证据，先更新本索引并检查引用。

开发、组件、接口与测试入口见[文档索引](../README.md)。

- [Lycobo 落地页 Logo 定稿](brand/lycobo-focus-approved.png)：2026-11-17 确认的 C「聚焦」图形，搭配用户提供截图中的宽体圆角字形重绘全小写 lycobo，采用纯白组合标识；正式资源为 `apps/web/public/brand/lycobo-landing.svg`，适用于当前落地页，规则见 DESIGN.md 第 5.1 节。导航使用自有 `apps/web/public/brand/lycobo-navigation.riv` 完成字母 c 到图形的滚动形变，生成脚本为 `scripts/brand/build-landing-logo.py`，维护规则见 DESIGN.md 第 5.2 节。

- [耳机 Hero 方向稿](../../apps/web/public/landing/headphones-hero-preview.webp)：2026-11-17 生成的中性灰整合素材，仅保留为独立图片的美术参考，已退出页面。
- 当前 Hero 使用独立生成的[棚拍主图](../../apps/web/public/landing/headphones-studio.webp)、[商品原图](../../apps/web/public/landing/headphones-source.webp)、[桌面场景](../../apps/web/public/landing/headphones-desktop.webp)与[材质特写](../../apps/web/public/landing/headphones-detail.webp)。均由 gen-image 基于同一耳机方向稿生成；照片分布在黑底首屏标题四周，宽屏增加两处局部裁切，棚拍图随滚动放大至浅色套图区。
