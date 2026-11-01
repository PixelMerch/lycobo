# CloudBase 业务数据库同步到本地 Docker

2026-11-01 19:38（北京时间）完成一次性快照同步。源为 CloudBase 上海环境 `lycobo-d9gyvxkegc54a1257` 的共享 PostgreSQL，目标为本项目 Docker `postgres` 服务中的 `lycoboai` 数据库，宿主机端口 `55432`。云端全程只读，未修改线上配置或数据。

## 范围与结果

同步 `public` 和 `drizzle` 全部业务结构与数据：44 张业务表、1 张迁移历史表，共 2,135 行。账号哈希、会话、模型配置密文、任务、素材元数据、积分和迁移记录保持原值；没有创建示例账号或修改余额。

全部表在同一条只读 SQL 的语句快照中导出，先恢复到候选库再验证。逐表将快照按目标表类型还原，统一 UTC，对排序后的完整行 JSON 计算内容指纹；45 张表全部匹配。切换前再次只读比较云端，行数与指纹均未变化。

结构核对：329 个字段、170 个约束、62 个非约束索引、21 个业务函数、2 个触发器、2 个枚举、5 个序列全部匹配。所有约束均有效；5 个序列的当前值和 `is_called` 匹配；钱包余额与流水合计差异为 0。保留业务表 RLS 开关，源业务表没有 RLS 策略。对象由本地 `lycoboai` 拥有，撤销 PUBLIC 的 schema、表、序列及函数权限；不复制云平台角色或角色密码。

CloudBase 托管的 `auth`、`storage`、`cloudbase_migrations` 系统 schema 不作为本地平台实现复制；应用账号位于 `public.enterprise_accounts` 等业务表，已包含在同步范围中。对象 key 和素材记录已复制，云端图片文件本身未复制到本地 SeaweedFS。此操作不是持续同步，也不是云存储迁移。

## 回退与私有文件

同步前已停止 `studio` 写入并生成 custom 格式备份。验证通过后，将原库改名为 `lycobo_before_sync_20261101` 保留，将候选库改名为 `lycoboai`。没有删除数据库卷或图片卷。

私有目录 `backups/database/cloudbase-to-docker-20261101/` 已被 Git 忽略，并限制为仅本机用户访问：

- `local-before.dump`：同步前本地完整数据库备份，已验证可读取目录。
- `local-before.env`：同步前本地环境配置备份。
- `cloudbase-data.json`、`cloudbase-schema.json`、`sequences.json`：云端业务快照与结构。
- `restore.sql`、`restore.log`：本次候选库恢复输入和执行记录。
- `data-verification.json`、`source-recheck.json`、`local-schema.json`：内容及结构核对证据。
- `cloudbase-restored.dump`：已恢复业务库的 custom 格式备份。

这些文件含私有业务数据，不得提交 Git。需要回退时，先停止 `studio`，保留同步后的库，再将原库切回 `lycoboai`；不要用删除卷的方法回退。

## 本地运行状态

已恢复 `studio`，容器 healthy；前端 `http://127.0.0.1:8081/` 和 API 健康检查均返回 200。快照内有 1 条 `needs_reconciliation` 生图记录，保持原状；本地 `.env` 设置 `IMAGE_GENERATION_ENABLED=false`，并验证消费者进程收到此配置，避免本地重复处理线上待核对任务。重新启用前须先处理复制任务的隔离及图片文件缺失问题。

未复制生产环境变量或解密密钥，也未发起付费生图。未运行浏览器 E2E。本次只执行数据库恢复与文档更新，没有修改应用代码或迁移文件；验证采用候选库实际恢复、全表内容与结构比较、约束和账务检查及本地健康检查。
