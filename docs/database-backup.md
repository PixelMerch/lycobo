# 本地数据库导出与恢复

本文只适用于本地 Docker 数据库。`schema.sql` 结构快照只到迁移 0015，不代表当前结构；当前结构以迁移链为准。CloudBase 与本地库的同步记录见 [CloudBase 迁移记录](cloudbase-migration.md)。

| 文件                                      | 内容                                                         | Git                    |
| ----------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| `packages/db/snapshots/schema.sql`        | 完整表结构、索引、约束、函数、触发器与序列定义，不含业务数据 | 提交                   |
| `backups/database/lycoboai-20261021.dump` | PostgreSQL custom 格式完整结构和数据备份                     | 忽略，仅保存在本地项目 |
| `backups/database/lycoboai-20261021.sql`  | 从同一备份转换的完整 SQL，含结构与数据                       | 忽略，仅保存在本地项目 |

完整备份包含账号、登录会话、组织余额及业务记录；目录权限 700、文件权限 600，不上传 Git。备份不包含 PostgreSQL 集群角色密码、环境密钥和图片二进制；图片位于 `data/images`，迁移应用时需另行备份。数据库中的图片记录不能代替图片文件。

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

后续导出时使用新的日期文件名，避免覆盖旧备份：

```sh
mkdir -p backups/database
chmod 700 backups/database
umask 077
docker compose exec -T postgres pg_dump -U lycoboai -d lycoboai \
  --format=custom --no-owner --no-privileges > backups/database/lycoboai-YYYYMMDD.dump
```

结构快照从同一个 custom 文件通过 `pg_restore --schema-only --no-owner --no-privileges --file=-` 导出。后续表结构变更仍需追加迁移，再更新快照；不要用快照直接修改已有数据库。

恢复旧完整备份后，使用正常追加迁移升级到最新版本。旧程序不支持当前结构，不得直接回退运行。不要混用结构快照与历史完整备份的迁移记录。
