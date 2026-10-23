# Supabase PostgreSQL 结构迁移

项目仍由 Hono API、独立 Worker 通过 PostgreSQL 驱动访问数据库，前端不直连数据库，不切换为 Supabase Auth 或 Data API。此次目标是将仓库已有结构初始化到 Supabase；本地用户、组织、余额、素材记录与图片文件不随结构迁移复制。

## 连接配置

在项目根目录 `.env` 中填写：

```dotenv
SUPABASE_PROJECT_REF=wjirihknptxjodgknbfy
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.wjirihknptxjodgknbfy.supabase.co:5432/postgres?sslmode=require
```

仅将 `[YOUR-PASSWORD]` 替换为数据库密码。密码中的 `@`、`#`、`/`、`?`、`&` 等保留字符需 URL 编码。`.env` 已被 Git 忽略，不提交真实密码；`.env.example` 仅保留占位。

迁移入口与运行时连接独立：专用命令只使用 `SUPABASE_DATABASE_URL`，并核对项目引用、数据库名、5432 端口和 TLS；未填写密码时在连接前退出，不会回退到本地库。API／Worker 使用 `DATABASE_URL`，Compose 还会用 `IMAGE_COMPOSE_DATABASE_URL` 覆盖容器内的 `DATABASE_URL`；切库时须同时配置，见下方运行时切换步骤。

该地址为 Supabase 直连端点，通常需要 IPv6 或项目的 IPv4 add-on。网络仅支持 IPv4 时，应从控制台 **Connect → Session pooler** 取得真实地址；不要自行拼接 pooler 主机。当前专用校验只接受上面的直连形式。参考 [Supabase 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)。

## 执行结构迁移

当前应用使用服务端鉴权和组织隔离，尚未为 Supabase `anon`／`authenticated` 建立前端访问策略。专用迁移命令会按当前 Drizzle 快照，对业务表启用 RLS，撤销 PUBLIC／anon／authenticated 的表、关联序列及本应用函数权限，不为前端建立访问策略。数据库所有者仍可通过现有 API／Worker 执行业务查询；不使用 FORCE RLS，也不更改 Supabase 自带表或集群角色。若结构成功但权限加固失败，命令返回失败，修复后重跑会跳过已执行迁移并重试权限加固。应用无需 Data API，建议在项目设置中关闭它；若以后启用前端直连，需先单独审查表权限及 RLS。关闭 Data API 不影响 API／Worker 的 PostgreSQL 直连。参考 [Supabase 数据访问安全](https://supabase.com/docs/guides/database/secure-data)。

先检查配置（不连接数据库）：

```sh
pnpm db:migrate:supabase --check
```

确认目标项目是专用的新数据库后执行：

```sh
pnpm db:migrate:supabase
```

命令调用已安装的 Drizzle Kit，按 `packages/db/migrations/meta/_journal.json` 重放现有追加迁移，保留正常的 Drizzle 迁移记录。不通过 `db push`，不导入 `backups/`，不修改 Supabase 自带的 `auth`／`storage` 结构。

当前链包含通用 `media_assets`／`generation_*` 命名及旧兼容视图移除，不需要额外创建旧表。迁移中的历史数据修正只处理目标库自身的数据，不从本地业务库读取。不要将 `packages/db/snapshots/schema.sql` 与全部迁移重复导入同一数据库；结构快照不含 Drizzle 执行记录，详见 [数据库备份与恢复](database-backup.md)。

迁移子进程设有 120 秒执行上限。连接或迁移失败时命令返回非零，不打印连接字符串、密码或原始驱动输出。修复连接问题后可再次运行；若数据库原先已有业务表但缺少迁移记录，应先核对结构，不能通过删表或伪造记录绕过冲突。

结构初始化成功不会自动切换应用连接。切换 API／Worker 时需协调同一个目标数据库、账号初始化／数据迁移与图片存储。

## API／Worker 运行时连接

2026-10-23 已将当前本地开发环境的 API 和 Worker 切换到上述 Supabase 项目。根目录 `.env` 中的 `DATABASE_URL`、`IMAGE_COMPOSE_DATABASE_URL` 与 `SUPABASE_DATABASE_URL` 使用同一个含 TLS 参数的完整连接地址；真实密码不提交。Node 本地启动读取前者，Compose 将第二项分别注入 API、Worker 的 `DATABASE_URL`。不依赖 dotenv 变量引用展开，也不在客户端加入 Supabase 密钥。

切换或更换密码时，先检查两边数据库及 Redis 队列没有待执行／执行中的任务，保留原数据库和图片文件；随后同步更新这三个配置，并在正常关闭服务后重新创建容器：

```sh
docker compose stop -t 370 api worker
docker compose up -d --no-deps --wait api worker
```

`restart` 不会重新加载环境变量。宿主机运行 `pnpm dev` 时也需重新启动 API／Worker 进程。API 的登录、图片记录和事件订阅以及 Worker 的 outbox／任务查询共用切换后的数据库，继续使用现有 Drizzle schema 与服务端账号体系。直连保留 LISTEN/NOTIFY 支持，不改用事务池端点。

Redis 与图片目录沿用现有配置，本地历史、素材、旧账号和积分不随连接切换复制到 Supabase；原 PostgreSQL 容器及数据卷保留。新建企业账号使用独立工作空间和零余额钱包，不代表已迁移旧业务数据。验收通过实际 HTTP 登录、会话、钱包、历史查询及退出完成，不调用付费生图。

隔离集成测试只允许 loopback PostgreSQL。运行时已经切换到 Supabase 后，必须为测试进程显式指定本项目的本地测试连接，不得让测试回退到远端库：

```sh
DATABASE_URL=postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai ALLOW_LOCAL_INTEGRATION=true pnpm test:integration
```

## Codex MCP

MCP OAuth 与数据库密码是两套认证，MCP 登录不会自动补充 `.env` 的 PostgreSQL 密码。

```sh
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=wjirihknptxjodgknbfy&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching'
codex mcp login supabase
codex mcp get supabase
```

在 Codex 交互窗口输入 `/mcp` 查看服务状态。已打开的会话可能需要重新加载 MCP 才能取得新工具；配置和 OAuth 成功不等于本轮会话已经执行过远端 SQL。项目已有 `.agents/skills/supabase-postgres-best-practices`，无需为此次接入重复安装或整体更新技能。

## 本次初始化验收

2026-10-23 已使用仓库迁移链完成目标项目 `wjirihknptxjodgknbfy` 的结构初始化：25 张业务表、199 个字段、116 个约束、91 个索引，字段／约束／索引与当时本地库一致；16 条 Drizzle 迁移记录的文件哈希及时间戳均匹配仓库。连接使用 TLS，远端业务表合计 0 行，未复制本地账号、余额、素材或文件。

25 张业务表均已启用 RLS，`anon`／`authenticated` 对业务表的读写权限为 0，本应用函数的前端执行权限也已撤销。重复执行迁移命令不重复创建表，权限加固可重复运行。这里的 0 行是结构初始化时的结果；之后已创建企业账号并按上文切换运行时连接。
