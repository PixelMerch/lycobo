# 电商专区与参考页说明

电商专区位于 `/commerce`，实现位于 `apps/web/src/features/home/landing/`。品牌首页位于 `/`。视觉由 [DESIGN.md](../DESIGN.md#5-品牌首页与电商专区) 维护。

2026-11-14 用户明确授权重新设计 Hero 下方，不要求保持参考站风格。Hero 保留，正文改为家纺摄影展台与浅色商品工具介绍，强调图片层级与有用途的 Motion 交互。

- Hero 继续使用 Gradient Waves 和四组平台对比，创作框进入实际工作区，不提交生成任务。
- 正文先用同系列家纺的全景、枕套、面料、床尾解释四种拍摄用途；手动切换与全屏浏览不提交任务。家纺图片来源见 [视角资源](textile-view-examples.md)。
- 用户随后指定 [Vidmuse winning-ads](https://vidmuse.ai/zh-CN/winning-ads) 的滚动动效。通过 ego-browser 实际观察其固定面板在滚动中推进 Research、Summarize、Create 的变化；本项目转译为家纺全景居中、局部依次展开、最终组成套图的连续过程，不复制参考站源码、图片或业务文案。实现位于 `use-commerce-scroll.ts`、`textile-scroll-board.tsx` 与 `commerce-textile-scroll.css`；几何及进度规范统一见 DESIGN 5.7、5.12。原生反向滚动可回收图片，窄屏、短窗口和减少动态效果直接显示静态图组。
- 然后用精华瓶、榨汁杯、外套三组原图／成片解释产品主图、场景和服装效果，用户手动切换。
- 商品对比与套图区沿用家纺的固定滚动舞台与静态回退条件：前者由原图退至一侧、成片展开呈现对比，后者由中央穿着图带出两侧细节和场景。滚动可倒放且不自动切换选择。每区只保留标题、必要短句和一个创作入口，套图移除重复三步列表；点击组图复用全屏图片浏览器。复制爆款有独立构图参考和真实入口。
- 输出面板保留比例、1.5K／2K／4K 与目标像素预览；预制成片以外的比例展示正确画框，不假装重新生成；页面省略 Sample images、效果示例等不必要小字。点击按此规格制作沿用规格交接和草稿确认，实际可用性由工作区能力检查处理。
- 10 张多品类模板以非等宽网格展示，保留提示词带入、登录返回和覆盖确认。移除两段无限轮播、吸附工作流、装饰文件夹和无意义统计。
- CTA 回到首屏，专区页脚保留真实工具、素材弹窗与法律链接，省略未配置的社交账号。
- 原有示例图片继续位于 `apps/web/public/landing/commerce/`，本轮重新编排而未重新生成。图片不是客户成果，来源见 [素材清单](landing-assets.md)。原 [DeepSeek 任务书](../ds.md) 保留提示词和历史背景，旧布局要求不再作为当前规范。
- 本轮参考了 [Photoroom 的商品场景介绍](https://www.photoroom.com/tools/product-staging) 中以图片解释用途的表达方式；未复制其图片、文案、品牌或性能承诺。采用 unslop（Damir Sokolovsky，CC BY 4.0）的内容审查方法，沿用 LYCOBO 的工具能力。

Hero 的参考采集与 Gradient Waves 来源仍见 [第三方材料](third-party.md)。不因当前正文改造删除 Hero 依赖或参考素材的来源说明。

用户指定的 taste-skill、Impeccable 与 Emil Kowalski 技能已安装在个人 Codex 技能目录，未改变项目依赖或技能快照。采用它们的图片主导、层级、克制文案与动效编排原则；仓库 PRD、DESIGN、HeroUI 与仅在 CI 运行浏览器 E2E 的约束仍优先。未安装全局设计 hook。
