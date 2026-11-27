---

name: lycobo-image
description: 通过 Lycobo 提交单图、套图和定时生图任务，返回任务编号。按用户要求准备本地参考图或自动下载原图。
---

# Lycobo 生图

从 Lycobo「应用连接」添加 HTTP MCP 连接器。将 `Authorization: Bearer <生图 Key>` 保存在连接器鉴权设置。凭据失效或工具缺失时提示检查连接器。

## 提交

- 单张调用 `generate_image`，传 `prompt`、`resolution`、`aspectRatio`、`requestId`。每套调用一次 `generate_image_set`，用 `title` 和 `images: [{title, prompt}]` 代替单条提示词。每套 1–20 张，共用比例和最多 5 张参考图。10 套就提交 10 个任务。
- 默认 `1.5K`，也支持 `2K`、`4K`。直接传 `aspectRatio`。有指定比例就用指定值，仅有用途就选适合的比例，否则用 `1:1`。工具缺少此字段时提示刷新连接器再提交。
- 有本地参考图时，按 [本地参考图](references/local-images.md) 查重并取得 `referenceAssetIds`。
- 每个新任务用新的 UUID。提交不确定时，仅用同一 UUID 和原参数补试。限流按服务端间隔等待。任务已受理后继续使用原任务，避免重复扣费。

## 回执与定时

从工具的文本 JSON 取 `id`、`publicId`、`historyUrl`。收到 `id` 后回复「已提交 · 任务编号」并用 `historyUrl` 链接编号。多套汇报受理数量及各套编号，单独说明未受理的原因。默认到此结束。用户要求自动下载时，再按 [自动下载](references/downloads.md) 登记本轮任务。

定时执行沿用已确认的频率、时区、选图规则、提示词、比例和分辨率。确认计划时说明 Lycobo 按张消耗积分。每次触发创建新的任务 UUID。
