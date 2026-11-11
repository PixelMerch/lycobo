# 企业账号密码登录

实现：Hono API、PostgreSQL 账号与会话、HS256 JWT、Node.js scrypt 密码哈希。企业账号密码可用。Google、Apple 和邮箱验证码通过 Supabase Auth 接入，由运行环境的配置启用。

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

| 方法与路径                         | 输入／行为                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /api/v1/auth/enterprise/login | JSON `{account,password}`；必须携带可信 Origin；成功返回 `{accessToken,tokenType:"Bearer",expiresIn:86400,refreshExpiresIn:2592000,user}` 并写 HttpOnly Cookie                        |
| GET /api/v1/auth/session           | 验证 JWT 后返回 `{userId,organizationId,role,account}`，另带可选 `uid`、`avatarPreset` 与 `preferredLocale`（偏好未选择为 null）；未登录／过期返回 401                                |
| POST /api/v1/auth/refresh          | 仅接受可信 Origin 和 HttpOnly 刷新 Cookie；轮换刷新凭据并签发新访问 Token，返回同登录的字段；刷新 Token 不进入 JSON                                                                   |
| POST /api/v1/auth/password         | 已登录；JSON `{currentPassword,newPassword}`，新密码 12–256 字符；验证旧密码，原子更新密码并撤销该账号全部会话                                                                        |
| PUT /api/v1/auth/avatar            | 已登录；Cookie 写请求同样校验可信 Origin；JSON `{avatarPreset}` 只接受 12 个预设 id 或 null（恢复默认），未知 id 或多余字段返回 400；只更新当前会话用户，返回带 `avatarPreset` 的身份 |
| POST /api/v1/auth/logout           | 撤销服务端会话并删除 Cookie；重复退出可安全返回 HTTP 200、code=0、data={}                                                                                                             |
| PUT /api/v1/auth/locale            | 已登录且 Cookie 请求来源可信；只接受 `{"preferredLocale":"zh-CN"}` 或 `{"preferredLocale":"en"}`，按会话用户写入并返回更新后的身份                                                    |
| POST /api/v1/image-session         | 企业模式下读取当前 JWT 身份，不再创建本地身份                                                                                                                                         |

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
- CI 浏览器回归覆盖表单校验、接口错误、登录成功、刷新恢复和退出；浏览器 fixture 不代表服务端验证。
- `ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:auth`：在 loopback PostgreSQL 创建独立临时数据库、执行全部迁移，验证账号、组织隔离、并发限流、禁用、重置与撤销，最后删除测试数据库和临时图片目录。不调用付费模型，不修改共享业务记录。
- 根 `pnpm test:integration` 已串联上述鉴权测试及原 DB／图片任务测试。

依赖 API 依据：[Hono JWT](https://hono.dev/docs/helpers/jwt)、[Hono Cookie](https://hono.dev/docs/helpers/cookie)、[Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)。

## 用户公开 UID

企业登录及会话身份返回 `uid`：随机 10 位纯数字字符串（例如 `0123456789`），允许前导 0，不随重新登录变化。内部 `userId`、JWT sub、成员关系及资源授权继续使用 UUID。迁移 0005 为已有用户补齐 UID，数据库唯一约束和原子号码登记防止重复分配；旧响应兼容允许缺省 UID。不得把公开 UID 作为授权依据，也不得转为数字存储。

## 自动续期与升级

前端通过既有每分钟会话检查和业务请求边界，在访问 Token 到期前 5 分钟内自动续期；休眠后恢复或重新打开页面遇到 401，也会刷新并重试一次。页面内合并并发刷新，支持 Web Locks 的浏览器跨标签页串行刷新；其他浏览器在轮换冲突时重新检查共享会话。业务 5xx 不触发重新提交；401 重试保留原请求体与幂等键。仅非敏感的到期时间保存在内存，Token 不写 localStorage 或 sessionStorage。

迁移必须先于 API 新代码部署，迁移未升级的旧 15 分钟会话不会自动获得长期权限，需再登录一次以领取刷新 Cookie。续期不清空草稿、不跳转页面；刷新凭据过期、账号失效或密码变更后恢复未登录状态。

隔离数据库集成验证 1 天／30 天期限、Cookie、并发轮换和旧凭据拒绝、仅刷新 Cookie 的退出、修改密码后双凭据撤销、30 天到期拒绝。浏览器测试覆盖自动恢复、并发请求合并、不保存可读 Token、退出后不自动登录。

## 预设头像

用户 2026-11-10 决定取消头像上传，头像只能从预设中选择，不涉及文件上传或对象存储。迁移 0044 为 `users` 新增可空的 `avatar_preset` 和 CHECK 约束（只允许 2–32 位小写短 id），未选择为 null。新代码会读取这一列，因此必须先应用迁移再部署 API，否则会话查询会失败。

契约 `enterpriseAvatarChangeSchema` 写入时严格限定为 `avatarPresetIds` 中的 12 个 id 或 null；身份响应读取时只要求短字符串且可缺省，后续部署新增预设时旧页面不会登录失败，只显示默认头像。登录、续期和会话响应都从同一身份查询返回 `avatarPreset`，前端保存成功后用返回的身份更新登录状态，顶部栏、账户菜单和设置立即同步，换设备登录也一样。配色只在前端定义，服务端只保存 id。

`test:auth` 隔离集成覆盖：新账号为 null、保存后会话返回新值、其他用户不受影响、数据库拒绝非法 id；单元测试覆盖未登录、未知预设、多余字段、恶意来源和恢复默认。

## 前端设置

账户菜单“设置”独立打开个人资料、登录与安全，以及企业管理员可见的企业成员分区。登录与安全调用既有`POST /api/v1/auth/password`，按当前密码和新密码提交，不发送确认密码；前端验证新密码长度及两次输入一致性，失败保留会话，成功清理当前登录查询、短期资源链接及续期状态并提示重新登录。密码仅存在当前表单及短生命周期mutation中，不写浏览器持久存储。头像只能从预设中选择（见上节“预设头像”）；设置不显示第三方账号绑定；企业子账号的主站接口尚未接入，相关入口保持禁用；成员页签可见性不代表已完成服务端成员管理权限。

### 界面语言偏好

迁移 0047 为 `users` 增加可空的 `preferred_locale`，只允许 `zh-CN` 与 `en`，旧账号保持 null。登录、续期及会话响应沿用同一身份查询，部署新 API 前须先应用迁移。登录成功时用已保存的语言打开原目标页面，保留查询参数和定位；普通访问时 URL 语言仍优先。账户设置和顶栏共用更新接口，账号语言与头像各自更新，访客语言仍保存在本机。


## 本地 Google 和 Apple 登录

- 在 Supabase Auth 中启用对应供应商。Google OAuth 客户端和 Apple Services ID 注册 Supabase 的 `/auth/v1/callback`，Google 测试阶段把测试邮箱加入 Audience。Apple 网页 OAuth 的客户端密钥有有效期，在到期前重新签发并更新 Supabase。
- 在 Supabase Auth 的 Redirect URLs 中添加实际本地访问地址，路径为 `/api/v1/auth/oauth/callback`。例如 `http://localhost:8081/api/v1/auth/oauth/callback`。该 Origin 同时必须列在本地 `AUTH_TRUSTED_ORIGINS` 中。
- 参考 `.env.example`，只在本地忽略的 `.env` 中填写 Supabase 项目 URL、Publishable key 与已启用的供应商。Google 和 Apple 的客户端密钥由 Supabase Auth 保管。这些 `DEV_` 配置仅在 `NODE_ENV=development` 时读取。
- 对本地 PostgreSQL 执行迁移 0048，然后以 `docker compose up -d --no-deps --wait --force-recreate studio` 载入配置。登录页从 `GET /api/v1/auth/oauth/providers` 读取可用入口。Hono 通过短期签名 Cookie 与 PKCE 交换验证 Supabase 身份，再签发 Lycobo 会话。成功后回到 `/{语言}/login?returnTo=…&oauth=success`，登录页据此提示“登录成功”再跳往原目标；失败回到同一路径并带 `oauth=failed`。这个参数只决定提示，登录状态仍以会话 Cookie 为准。
- 以 Supabase 用户 UUID 建立稳定关联，首次登录创建独立个人工作区和 10 位 Lycobo UID。若两个登录方式由 Supabase 解析为同一用户 UUID，则复用同一个本地账号。企业账号与已有 UID 沿用原记录，相同邮箱不会自动关联到企业账号。


## 本地邮箱验证码

1. Resend 验证发信子域并创建仅发送、限域的 API Key。在 Supabase Auth 的 SMTP Settings 使用 `smtp.resend.com:465`、用户名 `resend`、该密钥和品牌发件人 `Lycobo <no-reply@auth.lycobo.com>`。密钥只填 Supabase 控制台。
2. 在 Supabase Auth 的 Emails 为 Magic link or OTP 与 Confirm sign up 保存同一份[英文验证码模板](auth/email-otp.html)，主题为 `Your Lycobo sign-in code`。首次使用与再次登录均发送 `{{ .Token }}`，邮箱验证码长度配置为 6 位。邮件统一用英文，站内登录界面继续跟随用户所选语言。
3. Cloudflare Turnstile 本地组件只绑定 `localhost` 和 `127.0.0.1`。在 Supabase Auth 的 Attack Protection 选 Cloudflare Turnstile 并保存验证密钥。在本地 `.env` 填 `DEV_SUPABASE_EMAIL_TURNSTILE_SITE_KEY` 公开站点密钥并重新创建 studio 容器。
4. 用户点击发码才加载 Turnstile。Hono 检查可信 Origin 并将一次性令牌交 Supabase 验证，Supabase 验证成功后才通过 Resend 发码。邮箱和连接地址分别按发送及验证限流。开发代理下连接地址使用实际代理地址，全部本地代理请求共用该地址的配额。
5. 输入验证码后 Hono 采用 Supabase 返回的用户 UUID 复用本地账号与 10 位 UID。验证码与第三方认证共用主站会话签发；站内已有企业账号不会按邮箱自动关联。


## Workers 登录配置

- 部署读取第三方身份的版本前，生产数据库须先应用迁移 0048。已有企业会话也会通过统一身份查询读取新增字段。
- 主站的 Supabase 项目地址和允许的 OAuth 登录方式由 Wrangler 配置提供。向主站 Worker 版本单独注入 `SUPABASE_AUTH_PUBLISHABLE_KEY` 和 `SUPABASE_EMAIL_TURNSTILE_SITE_KEY`。前者是 Supabase 公开项目密钥，后者是 Cloudflare Turnstile 站点公钥。Google／Apple 客户端密钥、Resend SMTP 密钥和 Turnstile 验证密钥保存在 Supabase Auth。
- Supabase Redirect URLs 应允许 `https://lycobo.com/api/v1/auth/oauth/callback`。Google Cloud OAuth 测试状态下，仅测试名单内的账号可使用 Google 登录。
- Turnstile 线上组件须允许主站主机名，Workers 的邮件限流使用 Cloudflare 提供的连接 IP，缺失该地址时拒绝发码与校验。
