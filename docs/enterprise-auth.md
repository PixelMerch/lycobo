# 企业账号密码登录

实现：Hono API、PostgreSQL 账号与会话、HS256 JWT、Node.js scrypt 密码哈希。只接入企业账号密码，公众号扫码和短信尚未开放。

## 配置与创建账号

先执行 `pnpm db:migrate`，再设置服务端环境：

- `AUTH_JWT_SECRET`：至少 32 字节的随机密钥，不放入 VITE_*、代码或日志；更换后旧 JWT 失效。
- `AUTH_TRUSTED_ORIGINS`：逗号分隔的精确 Web Origin，不能使用通配符或带路径的 URL。生产只允许 HTTPS；development 可配置明确的 loopback HTTP Origin。
- `DATABASE_URL`：同一业务 PostgreSQL；Auth 池最大 3 个连接，Image Repository 池最大 5 个连接，关闭进程时共同释放。

账号绑定既有 `users` 和 `organization_members`，不通过公开注册接口赋予企业权限。账号全局唯一、3–128 位，以英文字母／数字起始，可包含 `. _ @ -`，忽略首尾空格与大小写。管理员在本地受控终端设置 `ENTERPRISE_ACCOUNT`、`ENTERPRISE_USER_ID`、`ENTERPRISE_ORGANIZATION_ID`，并通过临时环境变量提供密码，再执行：

```sh
pnpm --filter @lycoboai/api auth:account
```

密码默认至少 12 位；不使用命令参数传明文密码，不把它提交或留在 `.env` 中。该命令创建或更新账号，保持原用户和组织不变，重置密码时更新凭据版本并撤销旧会话；禁止将已有账号改绑到另一企业。对于用户明确指定的本地短密码，仅在 NODE_ENV=development、loopback 数据库且显式设置 ENTERPRISE_ALLOW_WEAK_PASSWORD=true 时允许，不适用于生产。

Compose 修改环境变量后运行 `docker compose up -d --no-deps --wait api`；仅代码改动由挂载与 watch 生效。启用企业认证后关闭浏览器的本地工作台身份自动兜底；原有服务端 43 字符 Bearer API key 继续可用。未配置 JWT 时保留原本地开发流程，企业登录返回 503。

## 接口

所有 JSON 响应遵循 [统一返回格式](api-response.md)，下表业务结果均放在顶层 data 内。登录令牌读取 data.accessToken，用户信息读取 data.user。

| 方法与路径 | 输入／行为 |
| --- | --- |
| POST /api/v1/auth/enterprise/login | JSON `{account,password}`；必须携带可信 Origin；成功返回 `{accessToken,tokenType:"Bearer",expiresIn:86400,refreshExpiresIn:2592000,user}` 并写 HttpOnly Cookie |
| GET /api/v1/auth/session | 验证 JWT 后返回 `{userId,organizationId,role,account}`；未登录／过期返回 401 |
| POST /api/v1/auth/refresh | 仅接受可信 Origin 和 HttpOnly 刷新 Cookie；轮换刷新凭据并签发新访问 Token，返回同登录的字段；刷新 Token 不进入 JSON |
| POST /api/v1/auth/password | 已登录；JSON `{currentPassword,newPassword}`，新密码 12–256 字符；验证旧密码，原子更新密码并撤销该账号全部会话 |
| POST /api/v1/auth/logout | 撤销服务端会话并删除 Cookie；重复退出可安全返回 HTTP 200、code=0、data={} |
| POST /api/v1/image-session | 企业模式下读取当前 JWT 身份，不再创建本地身份 |

兼容性：`system/capabilities` 保留旧 foundation 字段和值，新增加可选 `enterprisePasswordLoginEnabled` 标记企业登录是否已配置，旧客户端可忽略该字段。

API 客户端使用 `Authorization: Bearer <accessToken>`。浏览器只使用 `lycobo_enterprise_session` HttpOnly／SameSite=Strict Cookie（path=/api；生产 Secure），不把 JWT 放入 React 状态、localStorage 或 URL。Cookie 写请求校验精确 Origin 与 Sec-Fetch-Site；Bearer 请求验证令牌。未开放跨域凭据 CORS。

访问 JWT 有效期 1 天（86400 秒），刷新凭据有效期为本次登录起 30 天（2592000 秒）。不再设置 7 天上限，也不通过刷新延长最初的 30 天期限；临近会话截止时，访问 Token 会缩短到剩余会话时长。JWT 固定 HS256，验证 sub、org、jti、iat、exp、iss、aud、purpose；每次请求还验证服务端会话、账号状态、凭据版本及当前成员关系。

API 实例不缓存会话校验结果：后台停用账号、替换凭据以及在其他实例上的退出或改密码，都必须在下一次请求（包括已打开 SSE 的下一条事件）立即生效，`test:auth` 与 `test:events` 集成检查覆盖这一点。

访问 Cookie `lycobo_enterprise_session` 的 Path 为 `/api`，刷新 Cookie `lycobo_enterprise_refresh` 的 Path 为 `/api/v1/auth`；均使用 HttpOnly、SameSite=Strict，生产启用 Secure。刷新 JWT 含 32 字节密码学随机 nonce、独立的 enterprise-refresh 用途和签名会话 ID，数据库仅保存整个凭据的 SHA-256 哈希；迁移 0006 新增可空、唯一的 refresh_token_hash。每次刷新通过数据库原子条件更新轮换哈希，旧刷新凭据立即不可再用；并发刷新只有一个成功。拒绝刷新时不清除 Cookie，避免覆盖其他标签页已成功轮换的新凭据。

退出撤销当前会话；即使访问 Cookie 已过期，也会验证刷新凭据的签名并定位该会话。刚轮换的旧凭据只能撤销所属会话，不能再用于续期，避免退出与并发刷新竞态重新登录。通过改密码接口或已有账号设置命令修改密码，均撤销该账号全部会话，因此旧访问 Token 和刷新凭据同时失效；禁用账号、移除成员同样阻止访问和刷新。

错误密码与不存在账号统一返回 401“账号或密码错误”。PostgreSQL 原子限流：每账号 15 分钟最多 10 次尝试、全局每分钟最多 200 次；限流返回 429 与 Retry-After。登录请求体受 API 32KiB 限制，账号／密码有长度上限；不记录密码、JWT、Cookie 或请求体。

前端使用 TanStack Query 管理登录身份；登录／退出时取消旧请求，更新企业身份，并重置其他服务端查询：清除旧数据和错误状态、保留已挂载页面的查询订阅、自动重新获取工作台会话及其历史／素材，避免身份切换复用旧数据。无需刷新或跳转页面，保留用户的客户端创作草稿。Header 显示真实账号及“退出登录”；企业表单提交失败显示真实接口错误，不模拟成功。

## 验收

- `pnpm check`：密码哈希、错误口令、伪造／过期／错误受众 JWT、Cookie 标志、来源校验、退出撤销等单元测试。
- `pnpm test:e2e`：表单校验、接口错误、登录成功、刷新恢复和退出；浏览器 fixture 不代表服务端验证。
- `ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:auth`：在 loopback PostgreSQL 创建独立临时数据库、执行全部迁移，验证账号、组织隔离、并发限流、禁用、重置与撤销，最后删除测试数据库和临时图片目录。不调用付费模型，不修改共享业务记录。
- 根 `pnpm test:integration` 已串联上述鉴权测试及原 DB／Redis／图片任务测试。

依赖 API 依据：[Hono JWT](https://hono.dev/docs/helpers/jwt)、[Hono Cookie](https://hono.dev/docs/helpers/cookie)、[Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)。

## 用户公开 UID

企业登录及会话身份返回 `uid`：随机 10 位纯数字字符串（例如 `0123456789`），允许前导 0，不随重新登录变化。内部 `userId`、JWT sub、成员关系及资源授权继续使用 UUID。迁移 0005 为已有用户补齐 UID，数据库唯一约束和原子号码登记防止重复分配；旧响应兼容允许缺省 UID。不得把公开 UID 作为授权依据，也不得转为数字存储。

## 自动续期与升级

前端通过既有每分钟会话检查和业务请求边界，在访问 Token 到期前 5 分钟内自动续期；休眠后恢复或重新打开页面遇到 401，也会刷新并重试一次。页面内合并并发刷新，支持 Web Locks 的浏览器跨标签页串行刷新；其他浏览器在轮换冲突时重新检查共享会话。业务 5xx 不触发重新提交；401 重试保留原请求体与幂等键。仅非敏感的到期时间保存在内存，Token 不写 localStorage 或 sessionStorage。

迁移必须先于 API 新代码部署，迁移未升级的旧 15 分钟会话不会自动获得长期权限，需再登录一次以领取刷新 Cookie。续期不清空草稿、不跳转页面；刷新凭据过期、账号失效或密码变更后恢复未登录状态。

隔离数据库集成验证 1 天／30 天期限、Cookie、并发轮换和旧凭据拒绝、仅刷新 Cookie 的退出、修改密码后双凭据撤销、30 天到期拒绝。浏览器测试覆盖自动恢复、并发请求合并、不保存可读 Token、退出后不自动登录。
