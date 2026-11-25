# 本地开发

线上使用 Cloudflare Workers Static Assets、Hono API、独立图片 Queue Worker、私有 R2 与 Hyperdrive PostgreSQL。实时推送使用 Durable Objects + 可休眠 WebSocket，提示词优化保留 SSE。发布流程见 [Cloudflare 部署](releasing.md#cloudflare-运行与部署)。

本地使用 Node 24、pnpm 10.34.7、独立 PostgreSQL 与私有 S3（SeaweedFS），不使用旧平台模拟器或 Redis 队列。API、任务消费者、图片服务分别为独立 Node 进程，Vite 提供前端；消费者直接认领本地 PG outbox，复用生产任务处理器。

```sh
test -f .env || cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai pnpm db:migrate
pnpm dev
```

启动器 `scripts/local/dev.mjs` 固定使用本地业务数据库与存储，只继承路径、代理、终端等工具运行配置和 DEV_ 参数，其他凭据默认不进入子进程；模型设置必须显式配置。生图会产生真实供应商费用；默认关闭。数据库账号创建沿用已有管理脚本，不能将测试账户当作生产账户。

前端 `http://127.0.0.1:5173`，API `http://127.0.0.1:8787`，私有图片 `http://127.0.0.1:8791`。本地签名与 JWT 密钥每次启动随机生成，可信来源仅限配置中的本机地址。

本地带图视频使用单独的 `VIDEO_REFERENCE_ORIGIN`。将你控制的公网 HTTPS 域名转发到宿主机的 `127.0.0.1:8791`，在 `.env` 填入该域名的 HTTPS 源站后重新启动。隧道或反向代理需要保留对象路径与查询参数，并允许无需登录的签名读取。网页预览仍用本机地址，模型只获得短期签名原图。未配置公网入口时，本地可生成纯文字视频。

Docker 开发可使用 `docker compose up --build`，对外前端端口8081；首次启动前先完成上述数据库迁移。数据库与图片卷保留，禁止用删除共享卷解决问题。远端凭据、旧迁移备份、历史数据均不由本地启动器修改。

宿主机 `pnpm dev` 与 Docker `studio` 共用 5173、8787、8791 端口，切换前先停止原开发进程。如果提示 `address already in use`，用 `lsof -nP -iTCP:8787 -sTCP:LISTEN` 确认占用者，再停止属于本项目的进程。Docker 启动器为前端选择 `dev:docker`，监听容器的 `0.0.0.0`；容器健康后通过 `http://127.0.0.1:8081` 访问。

日常运行 `pnpm check`。隔离集成和手动浏览器检查见 [测试说明](testing.md)。

本地 Node 入口用于隔离 API、数据库和消费者验证。消息中心通过 HTTP 读取本地数据库中的系统通知和版本公告，并按当前会话保存已读状态；可休眠 WebSocket、R2、Images 和 Queue 的平台行为使用 `pnpm test:cloudflare` 验证。新环境从当前迁移链初始化，版本发布见[发布与部署](releasing.md)。

## 本地 S3 存储

主站本地用私有 SeaweedFS。独立管理后台使用另一个公开 Logo 桶，按 `model-logos/<uuid>.webp` 保存。业务参考图、原图及派生图留在私有桶，经身份、归属和短期签名访问。生产绑定见 [Cloudflare 运行与部署](releasing.md#cloudflare-运行与部署)。

| 配置                                                           | 约定                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `S3_ENDPOINT`、`S3_BUCKET`                                     | 分别填写服务源地址和桶名。Endpoint 不含桶名、路径、账号、查询或签名。HTTP 只用于 loopback 或既有 Docker 存储主机 |
| `S3_REGION`、`S3_FORCE_PATH_STYLE`                             | 默认 `us-east-1` 和 `true`。带点的桶名或 IP endpoint 只使用路径式                                                |
| `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_SESSION_TOKEN` | 服务端凭据，临时令牌按需设置并同步轮换，禁止放入源码、日志或 `VITE_*`                                            |
| `S3_REQUEST_TIMEOUT_MS`                                        | 默认 20000，范围 1000–120000，请求最多重试一次                                                                   |
| `S3_PUBLIC_BASE_URL`                                           | 只用于模型 Logo 公开桶                                                                                           |

Docker 主站私有图片使用 `http://image-storage:8333`，宿主机使用 `http://127.0.0.1:9004`；独立后台公开 Logo 使用 `http://model-storage:8333`。主站 Node 使用 aws4fetch，独立后台使用 AWS SDK v3。对象缺失返回空值，权限、超时和其他服务错误返回结构化错误。请求拒绝重定向，没有配置或服务异常时不切换存储。定向测试与隔离要求见 [私有 S3 验证](testing.md#私有-s3)。

## 本地数据库导出与恢复

仓库不附带业务数据备份。当前结构以 `packages/db/migrations/` 的 Drizzle 迁移链为准，新开发环境使用 `pnpm db:migrate` 初始化。

### 按需导出

按需导出本地 Docker PostgreSQL。使用新的日期文件名，避免覆盖已有备份。

```sh
mkdir -p backups/database
chmod 700 backups/database
umask 077
docker compose exec -T postgres pg_dump -U lycoboai -d lycoboai \
  --format=custom --no-owner --no-privileges > backups/database/lycoboai-YYYYMMDD.dump
```

完整导出含账号、会话、组织余额、业务记录及迁移记录。目录权限 700、文件权限 600，`backups/` 保持 Git 忽略。备份不包含集群角色密码、环境密钥和图片二进制，对象存储需单独规划备份。

### 恢复至隔离数据库

仅恢复到新建的隔离数据库，不覆盖正在使用的本地库、生产库或共享卷。以下名字和文件是示例，执行前确认文件存在并选择未占用的数据库名。

```sh
docker compose exec -T postgres createdb -U lycoboai lycoboai_restore
docker compose exec -T postgres pg_restore -U lycoboai \
  -d lycoboai_restore --exit-on-error --no-owner --no-privileges \
  < backups/database/lycoboai-YYYYMMDD.dump
```

完整备份保留其迁移记录，恢复后沿追加迁移升级。只有结构、没有迁移记录的 SQL 不能替代完整初始化。恢复后的检查应覆盖迁移版本、组织与任务归属、钱包约束、素材元数据及对应对象文件；没有数据备份时，空库迁移不能找回业务数据。
