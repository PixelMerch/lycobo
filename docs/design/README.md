# 设计资料索引

唯一视觉规范是 [DESIGN.md](../../DESIGN.md)，产品范围是 [PRD.md](../../PRD.md)。现行规范已纳入用户确认的后续品牌、导航与排版调整；实现时以当前规范、代码和实际浏览器验收为准，不将研究资料作为再次改版的授权。

只保留仍在使用的设计依据与素材来源：

- [积分与会员入口参考](credits-membership-references.md)：2026-11-02通过ego-browser查看小云雀与Oii公开价格页，记录双入口、充值与独立会员页的取舍。

- [我的素材与素材库 UI（已确认）](asset-library/README.md)：2026-11-03 用户确认并已实现的素材库页面、我的素材（默认当前工具）、生成／上传／收藏页签、功能／类型／模型筛选、服务端收藏与手机布局设计图。

- [个人中心与积分 UI（已确认）](account-center/README.md)：2026-11-02 用户确认并已实现的账户菜单、个人中心、积分概览、充值与充值明细设计图；个人中心同日改为弹窗，会员订阅保持现行方案页。

- [小云雀工作台排版实测](xiaoyunque-typography-measurements.md)：2026-11-02通过ego-browser核对已登录导航、账户菜单和字体覆盖范围；本站采用值已归入DESIGN.md。

- [Lycobo Logo 定稿](brand/lycobo-product-pilot-approved.png)：2026-11-01确认的 02「商品领航」方案：包裹、前进箭头及粗体字标；正式资源为 `apps/web/public/brand` 内的 SVG，配色与使用规则见 DESIGN.md。

- [电商工作台 UI 提案（待评审）](unified-creation/README.md)：基于 Photoroom 与小云雀实查的分类工具面板、单入口切换、下拉历史筛选、统一任务列表、固定模型选择，以及完整输入／确认／结果状态。仅为用户本轮要求的 UI 设计图，不替代现行规范、不表示功能已接入。

- [工作区功能栏参考与取舍](workspace-tool-navigation-research.md)：Refero Krea、Linear、Raycast 的中性导航参考与图标／左侧参数联动边界。
- [统一图片画布交互依据](canvas-workspace-decisions.md)：原地修复工作区的参考、取舍和验收范围；当前采用灰色点阵、鼠标白色波纹与桌面右侧竖向工具。
- [艺栢交互研究](yibai-page-logic.md)：工具选择、创作三栏与历史联动的参考依据。
- [小云雀登录样式实测](xiaoyunque-login-measurements.md)：官方测量值与本站校准值，最终规则归入 DESIGN.md。
- [参考站视觉语言实测](reference-style-dna.md)：艺栢与小云雀的色板、字号、圆角与密度，以及 Oii 账户弹窗层次、OiiOii 与小云雀首页内容层次复核，记录参考来源与取舍，不作为重新换色或调整密度的规范。
- [家纺样例图片来源](studio-photo-prompts.json)：对应 apps/web/public/studio 下仍在使用的三组样例素材，不代表真实客户商品或生成结果。

旧 UI 位图、版本对比稿、导出页面和一次性 UI 生图提示词已移出当前资料。不要重新以静态图维护第二份产品规范。新增参考只保留支撑当前决策的必要证据，先更新本索引并检查引用。

开发、组件、接口与测试入口见 [文档索引](../README.md)。
