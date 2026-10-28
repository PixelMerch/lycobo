# 主站生成图片的私有 S3 存储

生成 Worker、API 图片上传/读取、资源 Worker 共用 `imageObjectBucket`。配置 S3 后，新原图、PNG 缩略图、WebP thumbnail/preview 全部写入私有 S3；没有配置时保持原私有 R2。图片解码、尺寸限制、规范化、SHA256、UID/组织/资产 UUID 路径保持既有实现，不使用供应商临时 URL 作为永久素材地址。

## 数据与访问

数据库继续存 objectKey、尺寸、格式等资产元数据；不把私有 S3 URL 直接返回前端。API 按 owner/workspace 查询后签发短期链接，资源 Worker 验签并校验可信来源后访问私有 S3。原图下载与展示变体分离，签名、缓存、过期和跨租户规则保留。Logo 是公开资源，独立 admin 的 model-logos 桶与主站 generated-images 私有桶不能混用。

S3 404 时读取旧 R2 对象，确保已有图片仍可访问；权限错误、超时和 5xx 不伪装成空文件。新写入失败会继续走原有任务失败/对账规则，不静默写入其他后端，更不重新提交付费生成。移除会删除 S3 和旧 R2 的对应副本及变体，防止旧文件经回退重新出现。已有历史原图本轮没有批量搬迁；需要下线 R2 时须先单独规划校验迁移。

## 本地 Docker

`docker compose up` 新增 image-storage（固定 SeaweedFS 4.51 镜像及 digest），独立持久卷 image-storage-data。S3 仅绑定 `127.0.0.1:9004`，generated-images 桶只允许 docker-s3-images.json 内的本地服务身份，无匿名读取。该文件是开发 fixture 凭据，不能用于正式部署；不开放 Filer/管理端口。来源：[SeaweedFS mini](https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini)、[S3 Credentials](https://github.com/seaweedfs/seaweedfs/wiki/S3-Credentials)。

studio 的 API、生成、资源本地 Worker 均写入相同的本地 S3 配置，旧 .wrangler R2 状态保留用作历史读取。不删除已有卷。宿主机默认开发仍用本地 R2；本地启动脚本不会导入 .env 中的正式 S3 设置。非 Docker 的 Node 入口仅隔离工具，仍用原本的本地文件 store。

## 正式环境

为 API、生成 Worker、资源 Worker 同步配置 S3_ENDPOINT、S3_BUCKET、S3_REGION、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY。凭据使用 Worker Secrets，不放前端/VITE_*、源码或日志。Endpoint 为 HTTPS 源地址，桶预先创建并保持私有；服务身份只需要该桶的读写删除权限。所有 Worker 必须同时指向相同桶，否则无法读取新图片。原 IMAGES_BUCKET R2 binding 保留以读取历史对象，Images binding 继续处理图片。

适配使用 aws4fetch 签署 S3 SigV4，设置超时、有限重试并禁止重定向；只重试相同 objectKey 的存储请求，不涉及付费任务重新提交。没有自动为正式桶创建公开策略或自动部署。

本轮验证使用本地 S3 与 fixture 图片，没有调用真实付费模型、修改生产存储或批量迁移历史素材。
