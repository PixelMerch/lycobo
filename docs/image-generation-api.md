# Vakv 生图 API、队列与持久化

本实现是服务端接入，不修改前端。默认关闭生图，未使用真实密钥调用付费模型。
接口以组织为数据边界，用户身份来自服务端验证的访问令牌与数据库成员关系；请求体不得提供 userId、organizationId 或 workerId。
既有 `/api/v1/tasks` 契约和前端演示保持原状，新接口使用独立路径与新增数据库表。

## 模型能力证据

来源：[官方接口文档](https://docs.vakv.cn/wendang.html#gpt-image)、[价格页面](https://vakv.cn/pricing)、其公开数据接口 `https://vakv.cn/api/pricing`。

| 模型 | 官方文档确认的分辨率 | 默认可提交 |
| --- | --- | --- |
| gpt-image-2 | 仅 1K | 1K |
| gpt-image-2-4K | 1K、2K、4K；高分辨率为增强放大，不是原生 4K | 1K、2K、4K |
| gpt-image-2.5-flare | 价格目录存在，文档及价格接口未提供分辨率能力 | 暂不开放 |
| gpt-image-2.5-sunburst | 价格目录存在，文档及价格接口未提供分辨率能力 | 暂不开放 |

四个模型共用 `POST /v1/images/generations` 适配器。未知渠道完成代码适配，但须向服务商确认能力后由运维设置 `VAKV_CAPABILITY_OVERRIDES`，例如仅在确认后设置某渠道的 `["1K"]`；不能通过配置扩展基础版已知的 1K 限制。

分辨率转尺寸目前采用长边 1024 / 2048 / 4096、短边按比例对齐到 16 像素；文档仅展示了 `1024x1024` 示例，没有穷举各比例尺寸。此尺寸映射及所有高分辨率仍需真实渠道验收。保存返回图片的实际宽高，不将请求档位当作实际像素证据。

参考图编辑适配 `POST /v1/images/edits` multipart `image[]`，但本次文档没有给出该渠道编辑协议，所以默认 `VAKV_ENABLE_IMAGE_EDITS=false`，验证后再开。图片上传、校验、持久化和归属检查已经实现。

请求强制 `response_format=b64_json`，仅接受一张 base64 结果。当前不下载任意服务商返回 URL，防止未配置外部存储域名变为 SSRF；只返回 URL 的渠道会进入待核对，不自动重发。没有伪造异步 provider task ID 或轮询能力。

## 服务端配置与启动

1. 在工作树根目录复制 `.env.example` 为 `.env`，填写 `DATABASE_URL`、`REDIS_URL`、`VAKV_API_KEY`。
2. 设置 `IMAGE_DATA_DIR` 为绝对路径。API 和 Worker 必须使用同一持久目录/共享卷；不要放在 web/public 或容器临时层。当前实现是私有本地文件存储，不是 S3，也不支持多机独立磁盘。
3. 评审新增迁移后执行 `pnpm db:migrate`。不自动修改已有数据库，不使用 db push。
4. 创建本地运维接入身份与额度：

```sh
IMAGE_ADMIN_SUBJECT=existing-auth-subject \
IMAGE_ORGANIZATION_NAME=merchant-team \
IMAGE_INITIAL_CREDITS=20 \
pnpm --filter @lycoboai/api images:provision
```

脚本每次创建新组织，复用同 auth_subject 用户，并输出 userId、organizationId、keyId 和一次生成的访问令牌。令牌有效期 7 天，数据库只保存 SHA-256 摘要，不记录明文。妥善保管输出，不上传日志或 Git。该工具只供有数据库权限的运维使用，不是公开注册/充值接口。撤销令牌需由运维更新对应 image_api_keys.revoked_at；用户登录和团队邀请仍需对接正式身份系统。

5. 在 `.env` 显式设置 `IMAGE_GENERATION_ENABLED=true`、`IMAGE_WORKER_ENABLED=true`。保持 diagnostic 的 `WORKER_ENABLED` 独立；只跑生图时它可以为 false。
6. 分别启动 API 与 Worker：

```sh
pnpm --filter @lycoboai/api dev
pnpm dev:worker
```

Worker 缺少密钥/数据库/Redis 时启动失败，不以演示结果代替。API 本身不调用模型，也不把服务商密钥发给浏览器。
`IMAGE_CREDITS_PER_IMAGE` 是工作区内部每张消耗的整数积分，与服务商货币价格无关。初始额度由运维分配，不代表在线充值或支付接入。

## API

以下全部要求 `Authorization: Bearer <LycoBo 访问令牌>`，不是 Vakv 密钥。未验证身份返回 401，跨组织资源返回 404，错误包含 code、message、requestId。采用显式 Bearer 鉴权，不使用 Cookie，不开放凭证通配 CORS。

| 方法与路径 | 功能 |
| --- | --- |
| GET /api/v1/image-models | 四个模型、文档能力、实际启用档位与每张积分；enabled 仅代表配置开关，不代表 Worker 在线 |
| POST /api/v1/image-tasks | 创建任务，原子保存任务/图片项/outbox/积分预留，202；同 key 同参数重放返回 200 |
| GET /api/v1/image-tasks?limit=20&before=任务UUID | 组织内任务列表，按创建时间/ID 倒序，最大 100 条 |
| GET /api/v1/image-tasks/:id | 组织内任务、输入快照、逐图状态与输出元数据 |
| POST /api/v1/image-assets | 原始 PNG/JPEG/WebP 文件体，最大 10MB，返回资产 ID 与实际尺寸 |
| GET /api/v1/image-assets/:id/content | 身份与组织验证后读取图片，不直接暴露磁盘路径 |
| POST /api/v1/image-tasks/:jobId/items/:itemId/reconcile-failure | 管理员核对服务商后确认未成功，释放预留积分；不重发模型请求 |

提交示例（TOKEN 为上一步本地签发的应用访问令牌）：

```sh
curl http://127.0.0.1:8787/api/v1/image-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 4cbaf693-df1d-44c7-838b-3dd1aa802d58' \
  -d '{"model":"gpt-image-2","prompt":"米白陶瓷杯，阳光木桌场景","resolution":"1K","aspectRatio":"1:1","count":1,"referenceAssetIds":[]}'
```

查询记录会返回任务级 organization_id、user_id、model、prompt、resolution、aspect_ratio、requested_count、input、unit_credits、created_at、updated_at、completed_at，以及 items 的 worker_id、provider、provider_request_id、attempts、started_at、completed_at、output_asset_id、width、height、bytes、error_code。缺少服务商请求 ID 时保留 null，不用本地 ID 冒充。

服务端原图信息还保存在 image_assets：object_key、mime_type、bytes、width、height、sha256、组织、用户和创建时间。参考上传原文件上限 10MB；生成结果和规范化 PNG 上限 32MB，服务商 JSON 响应上限 45MB，避免高分辨率结果沿用上传体积限制。图片字节保存在私有文件目录，数据库保存文件元数据和关联，不塞入 JSON 或 Redis 消息。

## 任务与计费边界

- image_jobs 保存输入和逐图价格快照；image_job_items 保存执行实例、租约和图片关联。
- 同一组织/用户/Idempotency-Key 保持同一任务；换参数重放返回 409，数据库余额不足返回 409，均不产生付费请求。
- 任务、全部图片项、每图 outbox 和积分预留位于同一 PostgreSQL 事务。提交端不直接发 Redis 或调用服务商。
- Worker 从 PostgreSQL 租赁 outbox，事务外投递 BullMQ，投递后确认。消息只含 itemId，队列使用独立名字；并发执行由数据库领取与执行令牌再次保护。
- outbox 每 30 秒重新检查仍 queued 的图片项，可恢复 Redis 丢失或投递确认中断。running 不回到 queued，重复消息不重复调用模型。
- 每图独立执行与保存：成功保留扣除积分，明确拒绝退回该图积分；部分失败不删除成功兄弟图片。积分退款有唯一约束，不重复返还。
- 超时、断连、5xx、无法验证的响应、图片结果保存异常或执行租约到期，进入 needs_reconciliation，额度继续预留；不能靠队列重试重复付费。
- 服务商没有文档化幂等/查询协议。虽然发送稳定 Idempotency-Key 请求头，但不将其视为上游保证，不自动重试付费调用。
- 管理员必须先核对服务商记录，再提交 `{"verifiedFailed":true,"evidence":"服务商记录核对依据..."}` 确认失败。该接口记录核对人和依据，释放额度一次，不自动重新生成。实际已成功但本地无法入库的结果需要运维恢复文件/数据库，不可确认成未成功。
- 请求成功但进程在文件落盘与数据库提交之间退出可能留下孤立文件；任务会保留待核对，需运维核对后恢复或清理。当前没有自动成功结果恢复、计费回调或支付网关。
- 没有提供自动重发、公共注册、组织管理、成员邀请、在线充值、SSE、对象存储签名 URL 或自动清理。不要将服务端接入等同于生产上线。

## 验证与迁移

- `pnpm check`：类型、lint、单元测试和生产构建。
- `ALLOW_LOCAL_INTEGRATION=true DATABASE_URL=... REDIS_URL=... pnpm test:integration`：仅 loopback 的隔离 PostgreSQL/Redis，含已有诊断约束与新生图完整链路。通过本地 HTTP fixture 验证，不使用真实 key，不扣服务商积分。
- 新集成覆盖访问令牌、伪造身份、组织隔离、参考图越权、并发幂等、积分预留/释放、实际文件与元数据、重复队列消息、部分失败、服务商不确定结果、Worker 租约到期和令牌撤销。
- 新增 `0002_fuzzy_wolverine.sql` 与对应 Drizzle snapshot/journal；保留已合并的 0000/0001。它基于远端 dev 的迁移顺序，不包含主工作区未跟踪的其他 0002 草稿，合并前必须协调迁移编号。
- 真实渠道的 1K/2K/4K 输出像素、参考编辑以及 flare/sunburst 支持范围需在配置密钥后另行限额验收。模拟图片或静态页面不作为真实渠道证据。
