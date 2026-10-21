# 数据库完整导出与恢复

2026-10-21 从本地 PostgreSQL 17.11 导出当前数据库，包含截至 0009 的迁移。文件分为以下两类：

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
