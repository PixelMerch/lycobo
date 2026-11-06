# 国内内测与海外部署

> 2026-11-06 更新：本文保留历史操作与数据复制证据。dev 当前运行和发布方案以 [Cloudflare 部署准备](cloudflare-deployment.md) 为准；已移除旧 CloudBase 运行与发布入口，下面的历史命令不是当前部署步骤。

更新：2026-11-05。用户要求同时保留 CloudBase 国内内测环境及海外环境。已完成数据库快照与该快照引用的媒体文件复制；海外前端、API、消费者及鉴权媒体服务尚未部署，不能视为海外网站已可用。

## 环境与隔离

| 环境                                      | 用途与现状                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| CloudBase 上海 `lycobo-d9gyvxkegc54a1257` | 国内内测，继续使用原数据库、私有存储与已有云函数，入口保持现状，部署改为手动触发 |
| Supabase 新加坡 `uyfgzmqijdsesnlsiwqu`    | 海外数据库，区域 `ap-southeast-1`；当前控制台为 Free / Nano，本次未升级套餐      |
| Cloudflare 海外应用                       | 后续部署目标，前端、API、媒体及后台执行方式尚待实施                              |
| Cloudflare R2 `lycobo-media-prod`         | 已复制并校验 3,391 个私有对象，公开入口关闭                                      |
| 本地 Docker                               | 继续使用原 `lycoboai` 数据库及私有 S3，未替换为海外库                            |

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

本机根目录另有 `.env.cloudflare`，按中文注释集中整理海外 Cloudflare 管理配置、R2 S3 配置、新加坡数据库及计划使用的媒体/账号授权配置。该文件被 Git 忽略、权限为 600；R2 两项访问密钥已填写，桶名 `lycobo-media-prod` 与 Endpoint 账号匹配，真实读写验证见下文。海外 JWT 与媒体签名密钥已单独生成并仅保存在该私密文件中，尚未部署。

`.env.cloudflare` 不自动被 `pnpm dev` 或现有 CloudBase 发布流程读取，没有修改环境加载行为。后续工具需显式加载；不得与包含 `CLOUDBASE_*` 的原 `.env` 混合启动海外运行时。它不设置运行时 `DATABASE_URL`，后续部署时再由部署流程注入海外服务；本次文件迁移工具已使用 R2，但应用运行时和媒体服务尚未接入。

Codex 的 Supabase MCP 原来绑定旧项目，本次已将 `supabase` 服务的 `project_ref` 改为新项目并重新完成 OAuth 登录；未在配置中写入数据库密码。当前聊天的工具列表可能需要在重新加载后才显示更新后的连接。

`packages/db/scripts/supabase-target.mjs` 支持项目匹配的直连及官方 Session Pooler，要求 TLS，拒绝其他项目、伪造域名、6543 端口和覆盖连接目标的参数。`secure-supabase.mjs` 对当前业务表、序列及业务函数实施前端访问加固，包含提示词优化、回调和视频函数。

```sh
# 只检查配置，不连接数据库
pnpm db:migrate:supabase --check

# 后续明确需要升级海外结构时执行，不用于再次复制业务数据
pnpm db:migrate:supabase
```

国内后续结构更新继续走 `cloudbase/migrations/`；海外结构更新走 `packages/db/migrations/`。任何新增业务结构都要核对两端兼容性，不把其中一端的 SQL 原样重放到另一端已存在的结构。

## Cloudflare 前端部署步骤（已配置，尚未部署）

仓库根目录的 `wrangler.jsonc` 仅部署 React/Vite 静态前端，Worker 名称为 `lycobo`，资源目录为 `apps/web/dist`。SPA 回退让工作区等前端路径在刷新时返回 `index.html`；没有配置 API、R2、Hyperdrive、密钥或自定义域名绑定。本次仅准备配置，不执行发布。

在 Cloudflare 的 Workers 创建应用页面选择 `PixelMerch/lycobo`，按下表填写：

| 字段                     | 值                                                          |
| ------------------------ | ----------------------------------------------------------- |
| Project name             | `lycobo`，必须与 `wrangler.jsonc` 的 `name` 一致            |
| Build command            | `pnpm --filter @lycoboai/web build`                         |
| Deploy command           | `npx wrangler deploy --config wrangler.jsonc`               |
| Preview command          | `npx wrangler preview --config wrangler.jsonc`              |
| Advanced settings → Path | `/`，从仓库根目录构建，不填 `apps/web`                      |
| API token                | 保留 `Create new token`，由 Cloudflare 自动创建构建部署凭据 |
| API token name           | `lycobo-workers-build`，这是名称，不是密钥内容              |
| 构建变量 `NODE_VERSION`  | `24.13.0`                                                   |
| 构建变量 `PNPM_VERSION`  | `10.34.7`                                                   |

前端不需要 `.env.cloudflare` 中的服务端参数，不把数据库密码、R2 密钥、JWT 密钥或 Hyperdrive ID 填为前端变量。构建系统的 API token 用于授权发布，不是 R2 的 S3 Access Key，也不需要复制到 `wrangler.jsonc`。

操作顺序：

1. 确认所选远程分支包含 `wrangler.jsonc` 和需要发布的前端代码。Cloudflare 读取 GitHub 分支，本地提交不会自动出现在构建中；推送仍需用户单独授权。
2. 填写上表字段及构建变量。构建从根目录安装 pnpm workspace 依赖，仅构建 `@lycoboai/web`，产物为 `apps/web/dist`。
3. 当前停在配置阶段，不点 **Deploy**。用户决定发布时再执行该按钮；发布分支的后续提交也可能触发自动部署，需在 Builds 设置中确认分支规则。
4. 发布后先用 Cloudflare 提供的预览或默认地址核对首页、静态资源及前端路由刷新，再配置正式域名。域名和 API 接入不由本次配置自动完成。

2026-11-06 合并前检查发现 `lycobo` 已接入 Cloudflare Git 构建，推送 dev 曾自动启动预览构建。为遵守本次不部署要求，已停止该构建，并在控制台 **Settings → Builds → Production** 开启 **Disable builds**，在 **Previews Base** 关闭 **Builds for Preview branches**，均已保存。Git 连接保留；后续明确授权部署后再决定手动发布方式或恢复构建，不将该次停止的构建视为成功部署。

若日志提示在 workspace 根目录执行应用检测，先核对构建选中的分支和提交是否包含根目录 `wrangler.jsonc`，以及 Path 是否为 `/`。没有配置时 Wrangler 会尝试自动识别应用，在多包仓库根目录可能失败；部署命令显式添加 `--config wrangler.jsonc`，避免依赖自动识别。本地配置未推送前，远程构建仍会使用旧代码，不应仅把 Path 改为 `apps/web`。

本地可以用 `pnpm --filter @lycoboai/web build` 检查构建，不会发布。仓库尚未安装固定版本的 Wrangler；上表沿用控制台提供的 `npx` 命令，执行时会解析 Wrangler，后续自动化发布前应固定其版本。

前端请求使用同域 `/api/v1/...`；Vite 的 `server.proxy` 只用于本地开发。纯静态部署尚无海外 API，登录、钱包、素材和生成流程不能验收为可用。后续需要让站点的 `/api/*` 转到海外 API，并将 `media.lycobo.com` 交由鉴权媒体服务承接；SPA 回退不替代 API。

配置依据：[Workers Builds 配置与构建凭据](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Workers SPA 静态资源路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)。

## 私有证据与恢复

本机 `backups/database/overseas-20261105/` 被 Git 忽略，目录权限 700，敏感文件权限 600。包含：

- `source-snapshot.json`、`source-schema.json`、`source-sequences.json`：只读源快照、结构和序列状态。
- `verified-source.dump`：由已核对的隔离恢复库导出的 PostgreSQL custom 备份，不是对 CloudBase TCP 直连执行的 pg_dump。
- `stage-verification.json`、`isolated-restore.log`、`target-verification.json`：逐表指纹、完整恢复及目标权限/账务检查结果。
- `checksums.json`：源快照、结构、custom 备份与目标核对报告的 SHA-256。
- `target-restore.sql`、`import-target.sql`、`target-import.log`：本次受控导入及事务提交证据。
- `environment-before.env`、`codex-config-before.toml`：修改前的本机配置备份，包含敏感信息，不分享或提交。

保留两个独立本地恢复库 `lycobo_overseas_stage_20261105`、`lycobo_overseas_verify_20261105` 供核对；原开发库和共享卷未删除。本次海外环境还没有业务写入，回退应用无需切数据库，因为国内应用从未改用海外库。日后海外开始承接业务后，不能通过直接重导此快照回退，否则会丢失海外新增记录。

## R2 连接检查（2026-11-05）

- 独立加载 `.env.cloudflare`，必填配置完整，未混入 CloudBase 源端凭据。
- 使用项目现有 S3 适配器，在 `migration-check/` 下以随机对象名写入 128 字节测试数据；HEAD 字节数与 GET 的 SHA-256 均匹配。
- 连接测试对象已删除，再次 HEAD 确认不存在；该轮连接测试未复制真实素材，后续全量结果见下文。
- 海外配置已由用户选为 `ASSET_PATH_PREFIX=/images/`，现有 URL 生成器接受该前缀，生成的缩略图链接及签名校验通过。海外网关仍需按该前缀剥离路径后转发到媒体服务。
- 未签名 S3 GET 返回 HTTP 400，未读取到对象；不能据此断言所有公开入口已关闭。
- 初查时 `r2.dev` 已关闭，R2 自定义域名 `media.lycobo.com` 仍直接公开桶。用户随后手动关闭；文件迁移前及完成后管理 API 均确认两者 `enabled=false`。自定义域名仍保留在桶配置中，后续需改由鉴权媒体服务承接。

## 海外应用部署前必须处理

2026-11-06 用户选择海外计算服务统一使用 Cloudflare，不新增 VPS；Supabase 与 R2 保留。后端迁移的范围、业务不变量与验收条件见 [Cloudflare 后端迁移需求草案](../specs/cloudflare-runtime/requirements.md)。三个后端的运行配置与调度仍待设计、实施和验证，不将平台选择当作部署完成。

- 快照引用的有效媒体文件已复制到 R2，但海外 API 与鉴权媒体服务仍需部署；素材数据与文件齐全不代表网站已能查看媒体。
- 源快照含 1 条 `needs_reconciliation` 任务及对应历史 outbox/视频投递状态。海外消费者启用前，必须明确隔离复制的历史执行意图，不能自动接管国内待核对任务或再次调用付费供应商；不通过伪造成功、自动退款或删除账本解决。
- 部署海外 API 前建立独立运行凭据、JWT/签名密钥及可信 Origin；处理复制的会话和 API 凭据，不让两端登录或资源签名互相替代。
- 如启用后台加密的模型配置，核对凭据加密密钥及渠道归属。新加坡库里有密文不代表海外运行时已能解密或调用。
- 确定海外 API、消费者和媒体处理的实际运行方式；保持任务、扣费与 outbox 原子写入及未知结果不重投规则。
- CloudBase 国内内测与海外入口分别配置发布目标及凭据，避免一次发布把另一端配置覆盖。CloudBase 工作流已改为手动触发，main 合并不自动部署或创建版本。
- 本次未升级 Supabase 付费套餐；正式承接客户前按容量、备份和可用性需求另行决定，未自动购买付费能力。

## 第二阶段：文件迁移结果

完成时间：**2026-11-05 20:52 +08:00**。从国内私有桶 `lycobo-images` 复制至海外私有 R2 桶 `lycobo-media-prod`，保留原对象 key，不修改素材表。

| 核对项目   | 结果                                                               |
| ---------- | ------------------------------------------------------------------ |
| 迁移范围   | 海外数据库快照引用的 1,061 个有效原始文件：1,060 张图片及 1 个视频 |
| 派生文件   | 2,330 个已有预览图、缩略图、视频封面及供应商引用变体               |
| 合计       | 3,391 个对象，2,520,290,653 字节（约 2.52 GB）                     |
| 内容校验   | 每个对象读回比对字节数与 SHA-256；原始文件同时匹配数据库记录       |
| 完整性复查 | R2 分页清单共 4 页，3,391 项全部匹配，无缺项、大小差异或额外对象   |
| 删除记录   | 6 条已标记存储删除的素材排除，没有恢复已删除文件                   |
| 失败项     | 0                                                                  |
| 公开访问   | `r2.dev` 与桶自定义域名均关闭，未直接公开私有素材                  |

本次仅复制数据库快照关联的文件及实际存在的派生文件；快照后国内新增的素材和无关对象不纳入。没有重新生成图片、调用付费模型、删除国内文件或切换国内配置。源库与源存储均只读。

私有证据在 `backups/storage/overseas-20261105/`：`manifest.json` 是迁移范围，`progress.jsonl` 保留逐对象指纹，`report.json` 为完成汇总；`target-inventory.json`、`audit-report.json` 是完成后的独立 R2 清单复查，`checksums.json` 保存迁移清单、逐项进度、目标清单与复查报告的文件指纹。目录权限 700、文件权限 600，均被 Git 忽略。

## 文件迁移工具

`apps/api/scripts/migrate-storage.ts` 只处理已迁入海外数据库且未标记存储删除的素材，源配置读取 `.env`，目标读取 `.env.cloudflare`。固定校验源环境、新加坡项目和 R2 桶，并在操作前检查公共入口已关闭；不启用消费者、不更新数据库、不删除源对象。

先通过 CloudBase 管理端只读查询导出 `storage.objects` 中 `lycobo-images` 的对象清单，保存到私有目录 `backups/storage/overseas-20261105/source-objects.json`。本次使用的查询如下，文件保留 MCP 数据结果的 `rows[0].objects` JSON 字符串结构：

```sql
select json_agg(json_build_object('key', name, 'metadata', metadata) order by name) as objects
from storage.objects
where bucket_id = 'lycobo-images';
```

```sh
# 仅生成清单，原文件缺失时停止
pnpm --filter @lycoboai/api storage:migrate --plan
# 小批量复制，包含快照中的视频（若存在）
pnpm --filter @lycoboai/api storage:migrate --sample
# 全量复制或中断后继续
pnpm --filter @lycoboai/api storage:migrate --apply
```

原图和视频按 `media_assets.bytes/sha256` 校验；派生文件只复制源端实际存在的预览、缩略图、视频封面和供应商引用变体。源文件与目标读回内容逐项比较字节数及 SHA-256，目标存在不同内容时报告冲突，不覆盖。12 路文件传输不解码媒体；瞬时存储故障最多重试 3 次。

同目录的 `manifest.json`、`sample.jsonl`、`sample-report.json`、`progress.jsonl` 和 `report.json` 记录清单与结果，目录权限 700、文件 600。续传会重新校验目标对象与已有进度中的指纹，一致时不再下载源文件或重复上传；目标缺失时重新复制。控制台只输出汇总和安全错误码，完整对象路径仅保存在忽略的私有文件中。

## `/_images/` 路径约定

`/_images/` 是现有资源服务的路由前缀，网关将请求转给私有媒体服务；它不是文件名，也不是 CloudBase 强制添加的字符。前导下划线是项目用来区分内部服务路径和前端页面路径的命名约定。

下划线本身不提供权限或隐藏能力。实际访问受资源归属、短期签名、用途及过期时间等规则控制。国内继续沿用 `/_images/`；用户已将海外配置选为 `/images/`，后续海外部署须同步网关和 URL 生成，不能仅修改配置就视为路由已上线。

## 已执行验证

- `pnpm check`：lint、类型、单元测试和构建通过；文件迁移工具完成后共 413 项测试通过，1 项按既有条件跳过。构建仍提示历史下载模块同时静态/动态导入的既有分包警告，本次未修改该模块。
- 显式 loopback 数据库执行 `ALLOW_LOCAL_INTEGRATION=true DATABASE_URL=<本地连接> pnpm test:integration`：全部通过，使用一次性隔离库和供应商 fixtures，不调用真实付费模型。
- Supabase 目标实查：业务行数及指纹、钱包与流水、RLS/表列权限/业务函数权限通过；没有执行真实生成或支付。
- `pnpm db:migrate:supabase --check`：新项目 Session Pooler 配置检查通过。
- `pnpm db:migrate:supabase`：目标已具备完整迁移记录后再次执行成功，验证迁移工具及权限加固流程可用；这不是第二次业务数据导入。
- 文件迁移真实集成：小批复制、全量复制、逐对象读回校验、独立分页清单复查与公开入口复查均通过。
- 未运行完整本地 E2E。本次没有页面交互变更；海外浏览器完整流程需等 API 与鉴权媒体服务部署后验收。
