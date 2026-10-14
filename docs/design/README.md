# OiiOii 方向的新设计

这一版替换浅色 V3，并按最新反馈改为汽水绿、紧凑圆角卡片与单行标题。以 [DESIGN.md](../../DESIGN.md) 为规格，以可点击页面为布局真相。
下列 JPG 是本地 React 预览的实际浏览器截图；任务、商品与进度均为设计示例。

启动 `pnpm dev`，进入 <http://127.0.0.1:5173/design>。

| 页面 | 预览路径 | 设计图 |
| --- | --- | --- |
| 创作首页 | /design | [01-home.jpg](01-home.jpg) |
| 任务中心 | /design/tasks | [02-task-center.jpg](02-task-center.jpg) |
| 结果画布 | /design/canvas?task=demo-skin | [03-canvas.jpg](03-canvas.jpg) |
| 全局任务抽屉 | 右上角「全部任务」 | [04-task-drawer.jpg](04-task-drawer.jpg) |
| 案例灵感 | /design/inspiration | [05-inspiration.jpg](05-inspiration.jpg) |
| 我的项目 | /design/projects | [06-projects.jpg](06-projects.jpg) |
| 作品库 | /design/assets | [07-assets.jpg](07-assets.jpg) |
| 图片调整 | 结果画布 → 调整图片 | [08-image-edit.jpg](08-image-edit.jpg) |
| 新结果通知 | 右上角铃铛 | [09-notifications.jpg](09-notifications.jpg) |
| 个人账户 | 右上角头像 | [11-account.jpg](11-account.jpg) |
| 空输入状态 | 首页未填写描述 | [13-composer-empty.jpg](13-composer-empty.jpg) |
| 模型选择 | 输入区左下角 | [14-model-picker.jpg](14-model-picker.jpg) |
| 生成参数 | 输入区底部 | [12-generation-settings.jpg](12-generation-settings.jpg) |
| 移动端 | 390px 首页 | [10-mobile.jpg](10-mobile.jpg) |

## 可操作范围

- 案例分类，点击填入参考与描述，模拟连续提交，保持当前页。
- 跨页保留当前描述，筛选和搜索示例任务。
- 点击任务进画布；查看完成结果时取消该任务未读标记。
- 画布缩放、切换参考商品、调整示例图片亮度、下载真实 PNG。
- 抽屉使用 HeroUI 的焦点管理与 Escape 关闭。

## 明确边界

预览是临时内存状态，刷新恢复默认；支持最多 5 张本地图片读取与 @图片 引用；没有真实模型调用、收费、服务器上传或持久化存储。
画布当前是单图视觉与操作预览；拖拽无限画布、版本系统与多任务分组仍按产品规格后续实现。
正式工作台 `/` 的真实生成依然禁用。

[风格提取记录](oiioii-style-extraction.md) · [素材来源与提示词](asset-prompt.md)

- [15 · 多图参考与 @ 图片选择](15-image-mentions.jpg)
