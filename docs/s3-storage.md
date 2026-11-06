# 本地与独立后台的 S3 存储

主站生产使用私有 R2 和 Workers binding，配置见 [Cloudflare 部署](cloudflare-deployment.md)。本文件只描述隔离本地 Node 开发与独立后台的 S3 兼容存储。

## 服务端配置

| 参数                                    | 约定                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| S3_ENDPOINT                             | 服务源地址，不带桶名、对象路径、账号、查询或签名；正式环境HTTPS |
| S3_BUCKET                               | 桶名，不包含对象路径                                            |
| S3_REGION                               | 按当前 S3 端点配置地域，默认 us-east-1                          |
| S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY | 服务端凭据，不写入源码、日志或VITE变量                          |
| S3_SESSION_TOKEN                        | 可选临时令牌，与配套访问密钥同时更新                            |
| S3_FORCE_PATH_STYLE                     | true或false，默认true                                           |
| S3_REQUEST_TIMEOUT_MS                   | 默认20000ms，范围1000–120000ms；请求最多重试一次                |
| S3_PUBLIC_BASE_URL                      | 仅公开Logo桶使用，不能用于主站私有图片                          |

配置缺失时明确返回IMAGE_STORAGE_NOT_CONFIGURED，部分配置报错，不静默切换供应商。生产 R2 缺失或请求失败时明确报告错误，不切换到其他存储。S3对象缺失返回null，权限、超时与服务异常返回结构化错误；请求拒绝重定向，避免转发存储凭据。

路径式地址为https://service.example.com/bucket/object-key；虚拟主机式地址为https://bucket.service.example.com/object-key。带点桶名与IP端点只允许路径式。HTTP仅允许loopback及既有Docker存储主机。

## 当前环境

| 环境             | S3_ENDPOINT               | S3_REGION | S3_FORCE_PATH_STYLE |
| ---------------- | ------------------------- | --------- | ------------------- |
| 本地主站私有图片 | http://image-storage:8333 | us-east-1 | true                |
| 本地后台公开Logo | http://model-storage:8333 | us-east-1 | true                |
| 宿主机私有图片   | http://127.0.0.1:9004     | us-east-1 | true                |

主站Node适配使用aws4fetch签署标准S3请求；该库也用于本地S3，不是旧平台运行时。独立admin使用AWS SDK v3。两者共享配置约定，不强行混用运行时依赖。开发启动脚本隔离正式凭据，不能因远端环境文件改连生产桶。

参考图、生成原图和展示变体保持私有，访问须经过身份、归属与短期签名校验。模型Logo进入独立公开桶，使用model-logos/<uuid>.webp稳定路径。两类对象不共用公开权限，本地保留各自服务和持久卷。

## 验证

配置测试覆盖COS与Docker寻址、编码、地域、临时凭据和错误脱敏。对象测试覆盖授权请求、错误处理、私有访问、变体和删除；云端权限不由本地测试代替。

```sh
ALLOW_LOCAL_S3_INTEGRATION=true pnpm exec vitest run packages/storage/src/s3-config.test.ts packages/storage/src/s3-object-bucket.test.ts
```

此命令只连接固定loopback测试存储并清理本轮对象，不删除共享卷或历史数据。

## 上传图片保存期限

选择文件只在本地预览；点击生成时才上传私有对象存储。上传记录 `media_assets.expires_at` 默认为上传时间加3天。创建任务校验参考图、锁定记录、扣积分、取消参考图期限与写入任务/outbox 属于同一事务；额度不足、参数或权限校验失败不会转为长期保存。这里的成功扣积分指任务受理的扣费，后续生成失败退款不会把已经长期保存的参考图重新变回临时图片。生成结果继续长期保存。

消费者维护任务每次最多领取20个过期对象。领取与付费使用竞争相同的行锁，已领取清理的图片不能再次生成；原图、预览和缩略图一起删除。存储失败保留待清理记录，下轮重试；保留数据库墓碑，过期素材立即从读取和引用接口中隐藏。旧图片没有新增期限，不追溯删除。迁移0032与消费者需要一同发布，未部署的环境不会自动执行清理。

长期保存指对象生命周期，不代表公开永久URL；访问仍校验归属并使用短期签名。当前尚无账号上传容量或频率配额，3天到期不等同于防滥用限制。会话内成功上传的草稿ID缓存2天，避免部分上传失败后重试重复传已成功文件；浏览器刷新前尚未提交的本地草稿不保证云端保存。
