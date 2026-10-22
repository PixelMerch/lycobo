# 数据库完整导出与恢复

2026-10-21 的完整备份包含截至 0009 的迁移；当前 `schema.sql` 结构快照已随原任务重试更新到 0014（通用生成任务命名）。两者版本不同，恢复旧完整备份后需正常执行后续追加迁移。文件分为以下两类：

| 文件 | 内容 | Git |
| --- | --- | --- |
| `packages/db/snapshots/schema.sql` | 完整表结构、索引、约束、函数、触发器与序列定义，不含业务数据 | 提交 |
| `backups/database/lycoboai-20261021.dump` | PostgreSQL custom 格式完整结构和数据备份 | 忽略，仅保存在本地项目 |
| `backups/database/lycoboai-20261021.sql` | 从同一备份转换的完整 SQL，含结构与数据 | 忽略，仅保存在本地项目 |

完整备份包含账号、登录会话、组织余额及业务记录；目录权限 700、文件权限 600，不上传 Git。备份不包含 PostgreSQL 集群角色密码、Redis 数据、环境密钥和图片二进制；图片位于 `data/images`，迁移应用时需另行备份。数据库中的图片记录不能代替图片文件。

## 恢复完整数据库

仅恢复到新建的隔离数据库。以下名称为示例；若已存在，应换一个新名称，不能覆盖运行中的数据库。使用 PostgreSQL 17 客户端，建议与导出版本一致。

```sh
docker compose exec -T postgres createdb -U lycoboai lycoboai_restore
docker compose exec -T postgres pg_restore -U lycoboai \
  -d lycoboai_restore --exit-on-error --no-owner --no-privileges \
  < backups/database/lycoboai-20261021.dump
```

SQL 文件是同一份备份的替代入口，不能与 custom 备份重复导入同一个数据库：

```sh
docker compose exec -T postgres psql -U lycoboai \
  -d lycoboai_restore -v ON_ERROR_STOP=1 \
  < backups/database/lycoboai-20261021.sql
```

完整备份带有迁移记录，可按正常流程继续执行后续迁移。结构快照用于查阅和结构审查，**不能替代迁移初始化**：它不含迁移执行记录，导入后直接执行全部迁移会遇到对象重复。新开发环境使用 `pnpm db:migrate` 初始化。

## 验证与后续更新

本次 custom 备份已恢复到独立临时数据库，确认 24 张表、10 条迁移记录；完整 SQL 也单独恢复成功。验证后仅删除这两个临时数据库。现有业务库及共享卷未删除。

后续导出时使用新的日期文件名，避免覆盖旧备份：

```sh
mkdir -p backups/database
chmod 700 backups/database
umask 077
docker compose exec -T postgres pg_dump -U lycoboai -d lycoboai \
  --format=custom --no-owner --no-privileges > backups/database/lycoboai-YYYYMMDD.dump
```

结构快照从同一个 custom 文件通过 `pg_restore --schema-only --no-owner --no-privileges --file=-` 导出。后续表结构变更仍需追加迁移，再更新快照；不要用快照直接修改已有数据库。

当前结构快照已包含 `0012_asset_media_type`：`media_assets.media_type` 默认 `image`，
通过约束保留 `image`／`video`／`audio`；与表示参考输入／生成结果的 `kind` 独立。
新增媒体类型字段不代表已经接入视频或音频生成与存储。

`0013_media_assets_naming` 将素材实体原地改名为 `media_assets`，同步约束、索引和序列名称；
不复制或重建业务数据，保留 UUID、公开编号和外键关联。旧名 `image_assets` 暂作为
`security_invoker` 可更新兼容视图，供旧 API／Worker 的查询、插入及 `RETURNING` 使用。
它不是第二张素材表，不得作为新代码入口；旧版本全部退出后，再追加迁移移除视图。
兼容视图不支持 `INSERT ON CONFLICT`，当前旧素材写入未使用该语法。迁移不新增角色授权；
如果部署使用非表所有者角色，发布时还需按现有最小权限策略给该角色授予视图所需权限。
视图由追加 SQL 迁移管理，不加入 Drizzle 表模型；历史迁移中的旧名保持不变。
完整命名边界见 [数据库命名](database-naming.md)。

`0014_generation_naming` 将七张生成流程表统一为 `generation_*`；数据与关联原地保留，
并更新钱包关联校验函数。旧任务表名作为兼容视图保留，不保证旧版本 `ON CONFLICT` 写入兼容。
必须按 [生成任务迁移与发布顺序](database-naming.md#生成任务迁移与发布顺序) 协调 API／Worker
写入版本；不能在旧写入进程持续运行时直接迁移。旧备份恢复后正常追加执行迁移，
不要将当前结构快照与历史完整备份的迁移记录混用。
