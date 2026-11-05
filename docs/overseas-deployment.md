# 国内内测与海外部署

更新：2026-11-05。用户要求同时保留 CloudBase 国内内测环境及海外环境。当前只完成第一阶段数据库快照迁移；海外前端、API、消费者及媒体文件尚未部署或迁移，不能视为海外网站已可用。

## 环境与隔离

| 环境                                      | 用途与现状                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| CloudBase 上海 `lycobo-d9gyvxkegc54a1257` | 国内内测，继续使用原数据库、私有存储与已有云函数，入口及自动部署保持现状    |
| Supabase 新加坡 `uyfgzmqijdsesnlsiwqu`    | 海外数据库，区域 `ap-southeast-1`；当前控制台为 Free / Nano，本次未升级套餐 |
| Cloudflare 海外应用                       | 后续部署目标，前端、API、媒体及后台执行方式尚待实施                         |
| 本地 Docker                               | 继续使用原 `lycoboai` 数据库及私有 S3，未替换为海外库                       |

两端是独立数据库。本次为一次性快照复制，不是主从复制、双写或持续同步；快照后的国内新任务、资料修改、余额变化不会自动出现在海外，反向同样如此。后续账号与钱包各自变化，不能把两个环境的余额相加解释为一份共同可消费额度。

旧 Supabase 项目 `wjirihknptxjodgknbfy` 不是本次目标，未向它导入或覆盖数据。同组织内其他项目也未修改。

## 第一阶段：数据库迁移结果

源数据快照时间：**2026-11-05 19:15:41 +08:00**。源端和目标端均为 PostgreSQL 17.11。

| 核对项目   | 结果                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| 源快照     | `public` 与 `drizzle` 共 48 张表、10,555 行                                             |
| 业务数据   | `public` 的 47 张表、10,518 行，目标逐表行数及全行内容指纹全部匹配                      |
| 关键记录   | 2 个用户、2 个共享钱包、191 条生成任务、1,067 条素材元数据                              |
| 结构       | 353 个字段的类型与非空属性一致；183 个约束和 65 个非约束索引定义一致                    |
| 积分账务   | 钱包余额与所属流水之和差异 0，没有新增扣费、退款或充值                                  |
| 迁移记录   | 源端保留 37 条旧 Drizzle 记录；目标按当前完整迁移链保留 43 条，详见下文                 |
| 前端权限   | 47 张业务表均开启 RLS；`anon`、`authenticated` 无业务表及列访问权限，无业务函数执行权限 |
| 导入原子性 | 仅在目标业务表为空时导入；结构、数据、约束及权限加固在同一事务提交                      |
| 任务执行   | 没有启用海外消费者，没有调用付费供应商，未修改国内任务状态                              |

源端使用一次只读 SELECT 提取全部业务行，保证各表来自同一语句快照；JSON 行保留为文本，避免 JavaScript 数字转换丢失 bigint 精度。未对 CloudBase 执行写入、停服或迁移。

先在新建的本地隔离数据库中执行当前 Drizzle 迁移链，比较源端结构，再载入快照并逐表核对。随后生成 custom 格式备份，在第二个隔离库用 `pg_restore --exit-on-error --single-transaction` 恢复，验证外键和约束。最后仅向确认的新加坡空库导入；保留 Supabase 自带的 `auth`、`storage`、`extensions` 等平台结构。

CloudBase 后续结构更新走独立迁移链，因此源端 Drizzle 日志仍停在 0036。目标已通过当前 0000–0042 建立相同业务结构，保留这 43 条执行记录；不能用源端 37 条旧记录覆盖，否则后续运行 Drizzle 会重复执行已存在的结构变更。CloudBase 专属的网关/RPC 入口不整套照搬；Drizzle 自身包含的业务函数随对应迁移建立，客户端角色执行权限已撤销。

## 连接配置与迁移工具

迁移使用控制台展示的 **Session Pooler / 5432**，不是 Transaction Pooler / 6543：

```text
host: aws-0-ap-southeast-1.pooler.supabase.com
port: 5432
database: postgres
user: postgres.uyfgzmqijdsesnlsiwqu
TLS: require
```

本机到目标直连地址未连通，Session Pooler 已实测连接成功。完整密码和连接字符串只保存在忽略的 `.env` 与受限本地备份中，不写入文档、Git 或命令参数。

`.env` 仅更新 `SUPABASE_PROJECT_REF`、`SUPABASE_DATABASE_URL` 两个迁移配置；原 `DATABASE_URL` 与 CloudBase 配置保留。应用运行库尚未切换，不能把这两个迁移变量更新解释为海外 API 已接入。

本机根目录另有 `.env.cloudflare`，按中文注释集中整理海外 Cloudflare 管理配置、R2 S3 配置、新加坡数据库及计划使用的媒体/账号授权配置。该文件被 Git 忽略、权限为 600；当前 R2 两项访问密钥留空待填写，桶名与 Endpoint 需要按实际创建结果核对。海外 JWT 与媒体签名密钥已单独生成并仅保存在该私密文件中，尚未部署。

`.env.cloudflare` 不自动被 `pnpm dev` 或现有 CloudBase 发布流程读取，没有修改环境加载行为。后续工具需显式加载；不得与包含 `CLOUDBASE_*` 的原 `.env` 混合启动海外运行时。它不设置运行时 `DATABASE_URL`，后续部署时再由部署流程注入海外服务；当前填好参数不代表 R2 已接入或媒体服务已上线。

Codex 的 Supabase MCP 原来绑定旧项目，本次已将 `supabase` 服务的 `project_ref` 改为新项目并重新完成 OAuth 登录；未在配置中写入数据库密码。当前聊天的工具列表可能需要在重新加载后才显示更新后的连接。

`packages/db/scripts/supabase-target.mjs` 支持项目匹配的直连及官方 Session Pooler，要求 TLS，拒绝其他项目、伪造域名、6543 端口和覆盖连接目标的参数。`secure-supabase.mjs` 对当前业务表、序列及业务函数实施前端访问加固，包含提示词优化、回调和视频函数。

```sh
# 只检查配置，不连接数据库
pnpm db:migrate:supabase --check

# 后续明确需要升级海外结构时执行，不用于再次复制业务数据
pnpm db:migrate:supabase
```

国内后续结构更新继续走 `cloudbase/migrations/`；海外结构更新走 `packages/db/migrations/`。任何新增业务结构都要核对两端兼容性，不把其中一端的 SQL 原样重放到另一端已存在的结构。

## 私有证据与恢复

本机 `backups/database/overseas-20261105/` 被 Git 忽略，目录权限 700，敏感文件权限 600。包含：

- `source-snapshot.json`、`source-schema.json`、`source-sequences.json`：只读源快照、结构和序列状态。
- `verified-source.dump`：由已核对的隔离恢复库导出的 PostgreSQL custom 备份，不是对 CloudBase TCP 直连执行的 pg_dump。
- `stage-verification.json`、`isolated-restore.log`、`target-verification.json`：逐表指纹、完整恢复及目标权限/账务检查结果。
- `checksums.json`：源快照、结构、custom 备份与目标核对报告的 SHA-256。
- `target-restore.sql`、`import-target.sql`、`target-import.log`：本次受控导入及事务提交证据。
- `environment-before.env`、`codex-config-before.toml`：修改前的本机配置备份，包含敏感信息，不分享或提交。

保留两个独立本地恢复库 `lycobo_overseas_stage_20261105`、`lycobo_overseas_verify_20261105` 供核对；原开发库和共享卷未删除。本次海外环境还没有业务写入，回退应用无需切数据库，因为国内应用从未改用海外库。日后海外开始承接业务后，不能通过直接重导此快照回退，否则会丢失海外新增记录。

## 第二阶段前必须处理

- 图片、视频和头像二进制未复制到 R2。素材表有数据不代表海外能查看媒体；保留对象 key、真实尺寸与资源归属，迁移后逐对象验证。
- 源快照含 1 条 `needs_reconciliation` 任务及对应历史 outbox/视频投递状态。海外消费者启用前，必须明确隔离复制的历史执行意图，不能自动接管国内待核对任务或再次调用付费供应商；不通过伪造成功、自动退款或删除账本解决。
- 部署海外 API 前建立独立运行凭据、JWT/签名密钥及可信 Origin；处理复制的会话和 API 凭据，不让两端登录或资源签名互相替代。
- 如启用后台加密的模型配置，核对凭据加密密钥及渠道归属。新加坡库里有密文不代表海外运行时已能解密或调用。
- 确定海外 API、消费者和媒体处理的实际运行方式；保持任务、扣费与 outbox 原子写入及未知结果不重投规则。
- CloudBase 国内内测与海外入口分别配置发布目标及凭据，避免一次发布把另一端配置覆盖。现有 main 自动发布仍仅指向 CloudBase。
- 本次未升级 Supabase 付费套餐；正式承接客户前按容量、备份和可用性需求另行决定，未自动购买付费能力。

## `/_images/` 路径约定

`/_images/` 是现有资源服务的路由前缀，网关将请求转给私有媒体服务；它不是文件名，也不是 CloudBase 强制添加的字符。前导下划线是项目用来区分内部服务路径和前端页面路径的命名约定。

下划线本身不提供权限或隐藏能力。实际访问受资源归属、短期签名、用途及过期时间等规则控制。海外可以沿用同一路径，让网页通过自己的域名访问媒体；底层存储可以换成 R2。改成 `/images/` 需要一起更新网关、URL 生成和旧链接兼容，本次迁移没有改名。

## 已执行验证

- `pnpm check`：lint、类型、单元测试和构建通过；406 项测试通过，1 项按既有条件跳过。构建仍提示历史下载模块同时静态/动态导入的既有分包警告，本次未修改该模块。
- 显式 loopback 数据库执行 `ALLOW_LOCAL_INTEGRATION=true DATABASE_URL=<本地连接> pnpm test:integration`：全部通过，使用一次性隔离库和供应商 fixtures，不调用真实付费模型。
- Supabase 目标实查：业务行数及指纹、钱包与流水、RLS/表列权限/业务函数权限通过；没有执行真实生成或支付。
- `pnpm db:migrate:supabase --check`：新项目 Session Pooler 配置检查通过。
- `pnpm db:migrate:supabase`：目标已具备完整迁移记录后再次执行成功，验证迁移工具及权限加固流程可用；这不是第二次业务数据导入。
- 未运行完整本地 E2E。本次没有页面交互变更；海外浏览器完整流程需等 API 与媒体迁移后验收。
