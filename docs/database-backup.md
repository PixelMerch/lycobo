# 本地数据库导出与恢复

仓库不附带业务数据备份。当前结构以 `packages/db/migrations/` 的 Drizzle 迁移链为准，新开发环境使用 `pnpm db:migrate` 初始化。删除的本地备份不恢复，也不能把已删除的结构快照当作当前数据库结构。

## 按需导出

以下命令仅用于用户明确需要时导出本地 Docker PostgreSQL，不读取生产库；本轮代码清理不会执行它们。每次使用新的日期文件名，避免覆盖已有备份。

```sh
mkdir -p backups/database
chmod 700 backups/database
umask 077
docker compose exec -T postgres pg_dump -U lycoboai -d lycoboai \
  --format=custom --no-owner --no-privileges > backups/database/lycoboai-YYYYMMDD.dump
```

完整导出含账号、会话、组织余额、业务记录及迁移记录。目录权限 700、文件权限 600，`backups/` 保持 Git 忽略。备份不包含集群角色密码、环境密钥和图片二进制，对象存储需单独规划备份。

## 恢复至隔离数据库

仅恢复到新建的隔离数据库，不覆盖正在使用的本地库、生产库或共享卷。以下名字和文件是示例，执行前确认文件存在并选择未占用的数据库名。

```sh
docker compose exec -T postgres createdb -U lycoboai lycoboai_restore
docker compose exec -T postgres pg_restore -U lycoboai \
  -d lycoboai_restore --exit-on-error --no-owner --no-privileges \
  < backups/database/lycoboai-YYYYMMDD.dump
```

完整备份保留其迁移记录，恢复后沿追加迁移升级。只有结构、没有迁移记录的 SQL 不能替代完整初始化。恢复后的检查应覆盖迁移版本、组织与任务归属、钱包约束、素材元数据及对应对象文件；没有数据备份时，空库迁移不能找回业务数据。
