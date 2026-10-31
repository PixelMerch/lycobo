# 统一对象存储规则

主站与后台统一使用 S3 兼容协议和相同的服务端参数。R2、腾讯云 COS、AWS S3、本地 Docker 存储只在配置上区分，不在业务代码或前端增加厂商分支。主站 Workers 使用 aws4fetch，后台 Node 使用已安装的 AWS SDK v3，两者遵循同一配置与寻址测试；运行时依赖不强行混用。

## 服务端配置

| 参数 | 约定 |
| --- | --- |
| S3_ENDPOINT | 存储服务的源地址，不带桶名、对象路径、账号、查询参数或签名；正式环境 HTTPS |
| S3_BUCKET | 当前服务使用的桶名；COS 填包含 APPID 后缀的完整名称 |
| S3_REGION | 签名地域，默认 us-east-1；R2 可填 auto，COS 填桶实际地域 |
| S3_ACCESS_KEY_ID | 服务端访问标识，禁止 VITE_ 前缀或返回前端 |
| S3_SECRET_ACCESS_KEY | 服务端访问密钥，使用环境密钥管理；不写入源码或日志 |
| S3_SESSION_TOKEN | 可选临时凭据令牌；不使用时省略或留空，不能只替换令牌而不更新配套密钥 |
| S3_FORCE_PATH_STYLE | true / false，默认 true；不能用其他字符串模拟布尔值 |
| S3_REQUEST_TIMEOUT_MS | 单次请求超时，默认 20000，允许 1000–120000ms；最多两次存储请求尝试 |
| S3_PUBLIC_BASE_URL | 仅公开 Logo 服务需要；指向该公开桶根的稳定 CDN 地址，不是 S3 API 地址或临时签名链接 |

部分填写会明确报配置错误，不会静默切换厂商或把写入当作成功。省略全部连接参数时，主站可继续使用既有 R2 binding，后台上传返回未配置。HTTP 仅允许 loopback 和现有 Docker 的 image-storage/model-storage 主机，用于本地调试。

路径式：`https://service.example.com/bucket/object-key`；虚拟主机式：`https://bucket.service.example.com/object-key`。Endpoint 始终填写服务源地址，不能在使用虚拟主机式时再预先拼接桶名。带点桶名及 IP Endpoint 只允许路径式，避免 HTTPS 通配证书或 SDK 自动寻址产生差异。需要临时凭据时同样通过标准 S3 SigV4 令牌传递。

## 各环境只替换配置

| 环境 | S3_ENDPOINT 示例 | S3_REGION | S3_FORCE_PATH_STYLE |
| --- | --- | --- | --- |
| R2 | https://ACCOUNT_ID.r2.cloudflarestorage.com | auto | true |
| 腾讯云 COS | https://cos.ap-guangzhou.myqcloud.com | ap-guangzhou | false |
| Docker 主站私有图片 | http://image-storage:8333 | us-east-1 | true |
| Docker 后台公开 Logo | http://model-storage:8333 | us-east-1 | true |
| 宿主机调试 | http://127.0.0.1:9004 或 http://127.0.0.1:9002 | us-east-1 | true |

示例域名与桶名需要替换成实际配置；凭据只能放本地忽略的环境文件或部署平台 Secrets。后台 Docker 开发模式固定使用本地服务，不因正式环境文件中的密钥而访问云上桶。主站的本地启动脚本同样隔离正式配置，Docker 自动选择本地 S3；非 Docker 开发仍保留原本地 R2，不能直接加载生产环境密钥。

后台 AWS SDK 将可选 checksum 计算与校验设为 WHEN_REQUIRED，减少不同 S3 实现的扩展功能差异；核心协议仅依赖普通对象 PUT/GET/HEAD/DELETE。主站拒绝重定向，不向其他存储地址转发已签名请求。端点或地域错误应改配置，不依赖重定向发现桶。

## 公开资源和私有素材

- 主站上传参考图、生成原图、缩略图与预览图进入私有桶，数据库保存 objectKey 和元数据。访问必须经过归属校验和短期签名资源接口，不能直接使用公开桶 URL。
- 模型 Logo 进入独立公开桶，使用 `model-logos/<uuid>.webp`，数据库保存稳定公开地址。S3_PUBLIC_BASE_URL 已包含公开桶对应的路径（若需要），代码只追加对象键。
- 两类资源采用同一协议，不意味着共用公开权限。前端只消费业务 API 返回的地址，不配置厂商、桶或存储密钥。图片 decode/尺寸校验和现有上传协议保持不变。
- 本地保留两个独立服务/桶和持久卷，不删除共享数据。主站 generated-images 私有桶没有匿名读取，后台 model-logos 公开桶只承载公开 Logo。

## 切换与迁移

先建立目标桶、最小服务身份权限和读取策略，再复制对象并核对对象键、数量、大小及内容校验。API、生成 Worker、资源服务需同时指向相同私有桶；后台单独指向公开 Logo 桶。推荐给 Logo 使用自有稳定 CDN 域名，切换存储时保持数据库地址不变。

旧 R2 仅作为既有素材的兼容读取：S3 404 才回退，权限错误、超时、5xx 不回退，新写入失败不静默改写 R2；移除同时清理旧副本，防止重新出现。S3 适配器也支持不传 R2 fallback，适用于没有历史 R2 数据的环境。是否移除历史绑定需在迁移验收后单独处理。

统一的是存储协议和业务访问约定。本轮不迁移现有对象，不修改数据库结构，不改变主站当前 Workers/Images/Queues 运行时，也不代表整个主站已可直接部署至国内 Node 服务。

## 验证范围

两个仓库的 s3-config 测试使用同样的 R2/COS/Docker 参数，验证寻址、URL 编码、地域、临时凭据、错误配置和密钥脱敏。主站存储回归覆盖签名请求、失败不回退写入、无 R2 binding 的纯 S3、私有访问、变体和清理；后台覆盖真实图片解码与 Logo 上传地址。云厂商的真实凭据联调需在目标部署环境另行验收，本地测试不能宣称已验证云端账号权限。

官方参考：[R2 S3 兼容 API](https://developers.cloudflare.com/r2/api/s3/api/)、[腾讯云 COS 使用 AWS S3 SDK](https://intl.cloud.tencent.com/document/product/436/32537?lang=en)。

本地存储验收命令（只使用固定 loopback 测试配置，自动清理本轮对象）：

```bash
# 主站仓库
ALLOW_LOCAL_S3_INTEGRATION=true pnpm exec vitest run packages/storage/src/s3-config.test.ts packages/storage/src/s3-object-bucket.test.ts
# 后台仓库
ALLOW_LOCAL_S3_INTEGRATION=true pnpm --filter @lycobo-admin/api exec vitest run tests/s3-config.test.ts tests/model-logo-storage.test.ts
```

## 上传图片保存期限

选择文件只在本地预览；点击生成时才上传私有对象存储。上传记录 `media_assets.expires_at` 默认为上传时间加3天。创建任务校验参考图、锁定记录、扣积分、取消参考图期限与写入任务/outbox 属于同一事务；额度不足、参数或权限校验失败不会转为长期保存。这里的成功扣积分指任务受理的扣费，后续生成失败退款不会把已经长期保存的参考图重新变回临时图片。生成结果继续长期保存。

每分钟现有消费者维护任务最多领取20个过期对象。领取与付费使用竞争相同的行锁，已领取清理的图片不能再次生成；原图、预览和缩略图一起删除。存储失败保留待清理记录，下轮重试；保留数据库墓碑，过期素材立即从读取和引用接口中隐藏。旧图片没有新增期限，不追溯删除。迁移0032与消费者需要一同发布，未部署的环境不会自动执行清理。

长期保存指对象生命周期，不代表公开永久URL；访问仍校验归属并使用短期签名。当前尚无账号上传容量或频率配额，3天到期不等同于防滥用限制。会话内成功上传的草稿ID缓存2天，避免部分上传失败后重试重复传已成功文件；浏览器刷新前尚未提交的本地草稿不保证云端保存。
