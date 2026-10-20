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

| 方法与路径 | 输入／行为 |
| --- | --- |
| POST /api/v1/auth/enterprise/login | JSON `{account,password}`；必须携带可信 Origin；成功返回 `{accessToken,tokenType:"Bearer",expiresIn:900,user}` 并写 HttpOnly Cookie |
| GET /api/v1/auth/session | 验证 JWT 后返回 `{userId,organizationId,role,account}`；未登录／过期返回 401 |
| POST /api/v1/auth/logout | 撤销服务端会话并删除 Cookie；重复退出可安全返回 204 |
| POST /api/v1/image-session | 企业模式下读取当前 JWT 身份，不再创建本地身份 |

兼容性：`system/capabilities` 保留旧 foundation 字段和值，新增加可选 `enterprisePasswordLoginEnabled` 标记企业登录是否已配置，旧客户端可忽略该字段。

API 客户端使用 `Authorization: Bearer <accessToken>`。浏览器只使用 `lycobo_enterprise_session` HttpOnly／SameSite=Strict Cookie（path=/api；生产 Secure），不把 JWT 放入 React 状态、localStorage 或 URL。Cookie 写请求校验精确 Origin 与 Sec-Fetch-Site；Bearer 请求验证令牌。未开放跨域凭据 CORS。

JWT 有效期 15 分钟，固定 HS256，必须包含并验证 sub、org、jti、iat、exp、iss、aud 和用途。服务端每次查询会话、账号状态、凭据版本与当前组织成员关系，动态解析权限；退出、禁用、移除成员、重置密码都会使旧会话失效。没有 refresh token；过期后重新登录。

错误密码与不存在账号统一返回 401“账号或密码错误”。PostgreSQL 原子限流：每账号 15 分钟最多 10 次尝试、全局每分钟最多 200 次；限流返回 429 与 Retry-After。登录请求体受 API 32KiB 限制，账号／密码有长度上限；不记录密码、JWT、Cookie 或请求体。

前端使用 TanStack Query 管理登录身份；登录／退出时取消旧查询并清空缓存，避免身份切换复用旧数据，保留用户的客户端创作草稿。Header 显示真实账号及“退出登录”；企业表单提交失败显示真实接口错误，不模拟成功。

## 验收

- `pnpm check`：密码哈希、错误口令、伪造／过期／错误受众 JWT、Cookie 标志、来源校验、退出撤销等单元测试。
- `pnpm test:e2e`：表单校验、接口错误、登录成功、刷新恢复和退出；浏览器 fixture 不代表服务端验证。
- `ALLOW_LOCAL_INTEGRATION=true pnpm --filter @lycoboai/api test:auth`：在 loopback PostgreSQL 创建独立临时数据库、执行全部迁移，验证账号、组织隔离、并发限流、禁用、重置与撤销，最后删除测试数据库和临时图片目录。不调用付费模型，不修改共享业务记录。
- 根 `pnpm test:integration` 已串联上述鉴权测试及原 DB／Redis／图片任务测试。

依赖 API 依据：[Hono JWT](https://hono.dev/docs/helpers/jwt)、[Hono Cookie](https://hono.dev/docs/helpers/cookie)、[Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)。
