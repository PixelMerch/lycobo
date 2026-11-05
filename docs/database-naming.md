# 数据库命名与媒体边界

使用小写 `snake_case`、复数实体名和明确的业务前缀。素材使用 `media_`，共享生成流程使用 `generation_`，明确的图片编辑扩展使用 `image_`。
新增实体先确认是否与现有通用表重复；通用命名不等于所有媒体供应商已经接入。

| 表／对象                                                       | 当前职责与约定                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `media_assets`                                                 | 通用素材元数据；原 `image_assets`。`media_type` 表示 `image`／`video`／`audio`，`kind` 表示 `reference`／`output`，两者独立 |
| `generation_jobs`、`generation_job_items`                      | 共享生成任务与执行项；当前图片适配器仍使用现有分辨率、比例与数量约束                                                        |
| `generation_outbox`、`generation_retries`、`generation_events` | 生成流程的投递、幂等重试和持久事件；不是平台所有业务的通用消息表                                                            |
| `image_local_edits`                                            | 图片坐标选区和修改任务的来源关联；不用于视频或音频编辑                                                                      |
| `generation_api_keys`                                          | 生成 API 访问令牌；企业登录会话另存 `enterprise_sessions`                                                                   |
| `generation_credit_ledger`                                     | 生成任务既有账务记录；企业通用钱包使用 `organization_wallets`、`wallet_entries`，不能仅改名后合并账务                       |
| `tasks`、`task_items`、`outbox_events`                         | 已有基础任务／诊断流程；与图片生成链路分开，不能直接把 `generation_jobs` 改成 `tasks`                                       |

## 视频与音频

视频沿用 `generation_jobs`、`generation_job_items` 和 `media_assets`，异步意图及供应商任务 ID 保存在 `generation_video_outbox`，见[视频接入](video-generation.md)。音频未接入，`media_type` 已有类型约束不代表服务可用。新增媒体类型时通过媒体类型区分执行适配器，不要复制一整套仅前缀不同的任务／素材表。

新增数据库代码与查询必须携带服务端解析的组织／用户范围，改名不得削弱租户隔离。
