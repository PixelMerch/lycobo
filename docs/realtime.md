# Cloudflare 实时推送

生产使用 Durable Objects 的可休眠 WebSocket。提示词优化仍使用原有 POST SSE，两种通道职责独立。图片任务执行仍在 `lycobo-images`，连接终结在主站 `lycobo` 导出的 `RealtimeHub`；不是把图片处理放回主站。

## 事务与投递

`0043_realtime_push` 新增 `realtime_outbox`、`realtime_notifications`、`realtime_notification_reads` 和 `realtime_releases`。数据库触发器把 generation_events、wallet_entries 和消息插入转为同事务 outbox；回滚不会发出虚假通知。任务进入终态时产生一条面向提交用户的结果消息。积分包括生图、提示词优化、退款和充值等所有账本写入渠道，不依赖客户端推测。

API 写操作结束、提示词优化 SSE 关闭、图片 Queue 消费结束立即尝试投递；图片 Worker 每分钟的 Cron 恢复未确认意图。DO 确认后才标记 delivered_at，传输失败不重提付费任务。每批最多 100 条，DO 回执成功的 ID 在批次结束时通过一次 SQL 统一确认；中途失败只确认此前成功的记录，剩余项保留重试。重复投递使用同一事件 ID 和 DO 游标。业务数据以 PostgreSQL 为准，不以连接内存为准。正常推送无需等待 Cron；异常投递及部署公告由 Cron 补偿，积压较大时分批处理。

事件内容仅为资源 ID 和安全的发布摘要，不能包含提示词、模型响应、凭证和签名地址。按组织 UUID 路由 DO；个人消息同时按 userId 过滤。公开 `public` DO 只接收发布事件。

## 连接、休眠与补齐

- `GET /api/v1/realtime/connect?cursor=...`：HttpOnly 登录会话鉴权，严格可信 Origin。忽略客户端提供的组织、用户或身份头。会话有效性在握手时检查，投递批次再次查询当前有效会话，失效连接关闭后不再发送业务事件。
- `GET /api/v1/realtime/public?cursor=...`：仅公开发布摘要，游客也能看到新版本提示。
- 握手走内部 DO fetch，普通 RPC 不能序列化 WebSocket；向 Hono 返回时复制响应头并保留 webSocket。投递走 DO RPC。
- `acceptWebSocket` 保持连接可休眠。`ping` / `pong` 使用 `setWebSocketAutoResponse`，心跳不读取数据库，也不使用服务端定时器。DO 不为连接维持数据库长连接、持续 Promise 或定时查询。
- 每个用户最多 8 条组织连接。客户端指数退避并加入抖动，网络恢复、返回前台或凭证临近到期时重连；登录凭证不进入 URL。注销和身份切换会关闭原连接并清理计时器。
- SQLite 保存最近 1000 条事件，投递凭证保留 30 天。断线按游标回放，仅回放当前用户可见的消息；重复游标不重复应用。需要校准的首次连接、未知或过期游标返回 `ready.resync`，客户端按需重新读取任务、钱包、素材和通知。长时间离线仍可从 PostgreSQL 分页读取消息，不依赖 DO 短期日志保存消息正文。

前端取消原先 15／30 秒的任务状态 API 定时轮询。任务事件合并后定向读取最新任务，钱包与消息事件失效对应 Query 缓存；这是由事件触发的业务读取。连接空闲时只发送 WebSocket 心跳。上传文件的有限时长队列确认仍是上传操作自身的确认流程，不属于任务状态定时轮询。浏览器被冻结时无法保证后台立即绘制，恢复前台会主动补齐。

## 避免重复读取

钱包、消息事件在 150ms 内按资源合并；私人 WebSocket 完成握手后，提交回执、提示词优化结束和已读回执不再重复刷新相同资源。连接中断时，操作回执仍负责按需校准。任务状态事件不推测扣费或退款，账本事件是钱包更新的唯一推送来源。提交任务不会提前刷新尚未产生结果的素材列表，任务详情只在输出素材发生变化时校准素材缓存。

这会减少重复 GET 和同一变更多处 invalidate 导致的取消重发，但不把所有 API 读取消除。当前任务事件传资源 ID，排队、执行、完成各有一次必要的详情读取；只有真实状态变化才触发，空闲时不轮询。若以后要消除这些详情 GET，需要将安全的任务状态快照纳入推送协议，不能直接跳过刷新而让页面保留旧状态。

## 生成完成提醒

应用壳通过 `completion-observer.ts` 观察现有 TanStack Query 任务缓存，推送后的详情读取与断线校准共用完成判断，不增加 API 轮询。只有当前成员任务已成功或部分成功且存在真实输出时才提醒；首次打开不弹历史终态，已观察到的执行状态转终态则可正常补齐。

后台标签累计完成任务数，标题显示“（N）生成完成 · Lycobo”；回到前台恢复原标题、显示完成摘要。站内其他页面用 HeroUI Toast 提供“查看结果”，用户点击才导航 `?task=<uuid>` 定位历史，并在手机展开历史面板。当前结果已处于可见区域时不重复打扰；不恢复历史输入、不自动跳转或清空草稿。

本机回执以组织和成员隔离，保存近期 500 个任务去重记录及最多 100 个待展示定位，不保存提示词与图片链接。支持 Web Locks 时串行领取跨标签提醒；不支持时使用本机回执尽力去重。浏览器禁止存储时仅保证当前页面内去重。退出或切换身份清理监听、恢复标题并关闭当前页面的桌面通知。

桌面通知在消息中心由用户点击开启，默认关闭；浏览器权限和本机成员偏好必须同时允许。拒绝权限时提供浏览器设置说明。桌面通知不包含提示词，点击后才回到结果。当前没有接入关闭网站后的 Web Push；页面冻结、操作系统勿扰和浏览器策略都可能延迟提醒。PostgreSQL `realtime_outbox.delivered_at` 是服务端批次投递确认，不是浏览器接收或渲染回执。

CI 的完成通知浏览器回归使用显式 fixture，无需调用真实模型。

## 消息与版本

`GET /api/v1/notifications?before=<uuid>` 每页最多 100 条，仅当前组织中该用户可见的消息；未读总数独立计算。`POST /api/v1/notifications/:id/read` 幂等保存个人已读并推送到同用户其他连接。侧栏消息抽屉复用原有 HeroUI 结构，滚动读取后续页，错误可以重试。

`release.json` 是本次产品发布摘要，Vite 把 version 固化为当前页面版本。两个 Worker 部署成功后才执行：

```sh
node --env-file=.env --env-file=.env.cloudflare packages/db/scripts/publish-release.mjs --production
```

此命令限定当前 Lycobo Supabase 项目，幂等写入发布记录、各组织与游客的更新事件，并为各组织创建一条真实系统消息。凭证仅通过忽略的环境文件加载，不作为参数输出。运行前需要确认 .env.cloudflare 中的数据库目标覆盖旧环境；若只部署配置或修复日志，不应更改 release.json 或重复发布公告。

当前版本与最新已发布版本不同时，显示一次新版本 Toast，提醒用户先保存草稿再自行刷新；不会自动刷新、切换任务或清空草稿。首次安装实时能力前已经打开的旧页面需要主动刷新一次，才能开始接收 WebSocket。

## 验证与发布顺序

1. `pnpm check`：代码、类型、单元测试、Vite 构建及两个 Worker dry run。
2. `pnpm test:cloudflare`：独立本地 workerd、SQLite DO、R2、Images 和 Queue；覆盖同源握手拒绝、自动心跳、组织隔离、去重、游标回放、撤销会话关闭，以及提示词 SSE 所用运行时选项。使用临时持久目录，不使用线上绑定或模型。
3. `ALLOW_LOCAL_INTEGRATION=true ... pnpm test:integration`：独立 PostgreSQL 库验证完整迁移、事务回滚、账本事件、消息隔离、已读幂等与分页。不会修改生产用户或调用付费模型。
4. 先执行数据库迁移，再部署主站（创建 SQLite DO 命名空间及迁移），之后部署图片消费者的跨 Worker DO 绑定，最后发布摘要。
5. `NODE_USE_ENV_PROXY=1 pnpm cf:check:config` 同时检查控制台设置与 100% 活动版本，线上只读验证连接和页面；实际生图由用户线上测试。

官方依据：[WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[State 自动心跳 API](https://developers.cloudflare.com/durable-objects/api/state/)。
