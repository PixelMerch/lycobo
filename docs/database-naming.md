# 数据库命名与媒体边界

使用小写 `snake_case`、复数实体名和明确的业务前缀。前缀表达当前职责，不能仅因未来规划
就把图片专用业务改名为通用媒体能力。新增实体先确认是否与现有通用表重复。

| 表／对象 | 当前职责与约定 |
| --- | --- |
| `media_assets` | 通用素材元数据；原 `image_assets`。`media_type` 表示 `image`／`video`／`audio`，`kind` 表示 `reference`／`output`，两者独立 |
| `image_jobs`、`image_job_items` | 当前图片生成任务和逐图执行记录，含图片分辨率、比例、每图费用等约束 |
| `image_outbox`、`image_retries`、`image_events` | 图片生成流程的投递、幂等重试和持久事件；不是平台所有业务的通用消息表 |
| `image_local_edits` | 图片坐标选区和修改任务的来源关联；不用于视频或音频编辑 |
| `image_api_keys` | 现有图片 API 访问令牌；企业登录会话另存 `enterprise_sessions` |
| `image_credit_ledger` | 图片流程既有账务记录；企业通用钱包使用 `organization_wallets`、`wallet_entries`，不能仅改名后合并账务 |
| `tasks`、`task_items`、`outbox_events` | 已有基础任务／诊断流程；与图片生成链路分开，不能直接把 `image_jobs` 改成 `tasks` |

## 素材表迁移

`0013_media_assets_naming` 原地重命名表、索引、约束和身份序列，外键继续关联同一个实体。
业务代码使用 `media_assets`，Drizzle 导出使用 `mediaAssets`；旧 API 和 Worker 通过
`image_assets` 兼容视图读写同一份数据。兼容视图的限制与退出流程见
[数据库备份与恢复](database-backup.md)。公开 ID 和现有图片接口路径保持兼容，
历史迁移不可重写。这里的数据库命名不要求同步重命名图片专用 HTTP 契约。

## 后续视频与音频

当前生成、上传、解码和存储仍只接入图片。`media_type` 已有类型记录与约束，
不代表视频／音频服务已经可用。当前 `width`／`height` 必填，不能写入伪造尺寸来保存音频。
实际接入时应追加迁移，按类型约束图片／视频尺寸、音视频时长等媒体元数据；
同时设计各自的提交、计费和执行语义。只有真正共享任务模型后，才提取 `generation_*`
通用流程，并通过 `media_type` 区分；不要复制一整套仅前缀不同的素材表。

新增数据库代码与查询必须携带服务端解析的组织／用户范围，改名不得削弱租户隔离。
