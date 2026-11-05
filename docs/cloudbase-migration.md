# CloudBase 迁移记录

2026-10-31 至 11-02，主站从 Cloudflare Pages／Workers、R2 和 Supabase 迁到上海 CloudBase 个人版环境 `lycobo-d9gyvxkegc54a1257`，未升级套餐。本文只保留核对数据和排障需要的结论；当前部署方式见 [CloudBase 部署](cloudbase-deployment.md)。

## 结果

| 项目 | 结果 |
| --- | --- |
| 数据库 | Supabase 到 CloudBase 共享 PG，两端 PostgreSQL 17.11。范围为 `public`、`drizzle`，共 43 张表（42 张业务表和 Drizzle 迁移表）、1,156 行，逐表行数和全行内容指纹匹配，钱包余额与账本无差异 |
| 图片 | 116 条素材、464 个对象（约 408 MiB）复制到 `lycobo-images` 私有桶，逐对象比对字节数和 SHA-256，`object_key` 未改 |
| 运行时 | API、资源服务和消费者切到 CloudBase 云函数。2026-11-01 主图制作、家纺裂变、套图计划各真实生成 1 张，原图、预览和缩略图均可读取，钱包与流水核对差异 0 |
| 旧平台 | 2026-11-02 按用户授权删除 Cloudflare Pages `lycobo`、Workers `lycobo-api`／`lycobo-generation`／`lycobo-assets` 和 R2 桶 `lycobo`（清空 464 个对象后删除）。未删除 Cloudflare 账户、域名、Queues 或 Hyperdrive。旧运行时代码和依赖已从仓库移除 |

## 仍然有效的约束

- 不得把旧 Drizzle 迁移全部重放到 CloudBase 已导入的结构上。CloudBase 结构变更只走 `cloudbase/migrations/` 的追加迁移。
- 复制时已有 1 条 `needs_reconciliation / WORKER_OUTCOME_UNKNOWN` 任务，保留待核对状态，不自动重新提交、退款或补扣费。
- 独立 admin 未接入目标库，不能用它向旧库调整新站余额或配置。公开 Logo 桶也不在本次切换范围内。
- Supabase 旧源库和备份保留供回溯，不作为当前应用的回退存储。`pnpm db:migrate:supabase` 只用于显式运维，使用独立的 `SUPABASE_DATABASE_URL`。
- `lycobo.com` 曾配置 CloudBase 域名和证书，平台状态 FAIL，返回域名未备案。用户已确认暂不接入自定义域名，未修改 DNS。

## 本地库同步（2026-11-01）

本地 Docker 的 `lycoboai` 数据库来自 CloudBase 的一次性快照，共 45 张表、2,135 行，内容指纹全部匹配。原库改名为 `lycobo_before_sync_20261101` 保留。回退时先停止 `studio`，保留同步后的库，再将原库切回 `lycoboai`；不要用删除卷的方法回退。

快照内的云端待处理任务 `W6E39Z4NK` 已在本地隔离（`superseded_at`），防止本地消费者接管。本地未复制生产环境变量。

## 私有证据

以下文件被 Git 忽略，只存在于本机，含私有业务数据：

| 目录 | 内容 |
| --- | --- |
| `backups/database/cloudbase-20261031/database-copy/` | 数据库复制备份 `source.dump`（SHA-256 `10116bda9bfe7a488ab390922ea70e9b7e96830d13e9bbbff3232fcde502636b`）、逐表清单和核对结果 |
| `backups/storage/cloudbase-20261031/progress.json` | 逐素材和逐对象迁移清单 |
| `backups/database/cloudbase-to-docker-20261101/` | 本地库同步前备份、云端快照和核对结果 |
| `backups/database/local-generation-enable-20261101/` | 隔离复制任务前的本地备份 |
| `backups/retired-emulation-20261102/` | 旧模拟器状态 |
