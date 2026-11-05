# API 统一返回格式

所有 JSON 接口使用同一外层结构，包括企业登录、退出、会话、生图、系统能力、健康检查、404、参数错误和服务端异常。图片原图／缩略图下载继续返回二进制；HEAD 按 HTTP 规范不返回响应体。

```json
{
  "request_id": "06a4ddc8-f532-46ec-9e55-3779947aba2b",
  "code": 0,
  "message": "成功",
  "data": {},
  "error": {}
}
```

- `request_id`：服务端为每个请求生成 UUID，与响应头 X-Request-Id 一致，不信任客户端传来的 ID。日志仍可使用内部 requestId 字段关联。
- `code`：数字业务码，成功固定为 0；错误使用稳定非零码。它不是 HTTP 状态码。
- `message`：成功固定“成功”；失败为安全的中文提示，不返回异常堆栈、数据库错误、密码或服务商原文。
- `data`：原接口业务结果整体放入此处，成功保留业务对象或集合；无结果和错误时为 `{}`。列表原有业务结构保留，例如原 `{data: [...]}` 现在位于外层 data 内，不丢失已有分页或列表字段。
- `error`：成功为 `{}`；错误包含原符号标识，例如 `{ "code": "INVALID_CREDENTIALS" }`，供排错使用。中文提示只放顶层 message。

失败示例（HTTP 401）：

```json
{
  "request_id": "06a4ddc8-f532-46ec-9e55-3779947aba2b",
  "code": 20002,
  "message": "账号或密码错误",
  "data": {},
  "error": { "code": "INVALID_CREDENTIALS" }
}
```

## 业务码

唯一代码表为 packages/contracts/src/api-response.ts，不在业务模块另定义同名数值。

| 数值  | 标识                        |
| ----- | --------------------------- |
| 0     | 成功                        |
| 10001 | VALIDATION_ERROR            |
| 10002 | INVALID_REQUEST             |
| 10003 | PAYLOAD_TOO_LARGE           |
| 10004 | INVALID_IMAGE               |
| 10005 | REFERENCE_NOT_FOUND         |
| 10006 | MODEL_CAPABILITY_UNVERIFIED |
| 20001 | UNAUTHORIZED                |
| 20002 | INVALID_CREDENTIALS         |
| 20003 | FORBIDDEN                   |
| 20004 | UNTRUSTED_ORIGIN            |
| 20005 | RATE_LIMITED                |
| 30001 | NOT_FOUND                   |
| 30002 | IDEMPOTENCY_CONFLICT        |
| 30003 | INSUFFICIENT_CREDITS        |
| 30004 | STATE_CONFLICT              |
| 40001 | GENERATION_NOT_CONFIGURED   |
| 40002 | AUTH_NOT_CONFIGURED         |
| 50000 | INTERNAL_ERROR 或未分类异常 |

HTTP 状态码保留：任务首次提交 202、幂等重放 200，失败根据原因返回 400／401／403／404／409／413／429／500／503。退出登录改为 HTTP 200 + 成功空对象，统一替代旧 204。查询到一个状态为 failed 的任务仍是成功查询，code=0，任务状态在 data 中。

## 实现与迁移

createApp 的唯一出口层统一包装 JSON；业务路由只返回业务 payload 或内部结构化错误，不重复手工包外层。二进制内容不缓存或解析为 JSON。Set-Cookie、Retry-After、安全响应头和 HTTP 状态保留，旧 Content-Length／ETag 随 JSON 内容更新清除。

前端在 lib/api-response.ts 的 HTTP 边界拆包一次，业务领域的 Zod Schema 继续验证数据；auth 和图片请求共享该规则。新前端临时兼容旧服务器的未包装数据以支持发布切换，服务器仅输出新格式。API 消费方需将原业务字段读取路径迁移到 data；不得把这次响应结构调整描述成对所有旧客户端完全兼容。

契约测试验证 UUID、数值业务码、成功／失败结构与非零码处理；API 测试覆盖健康检查、参数和体积限制、未配置、404、异常脱敏；浏览器和隔离集成测试验证登录、Cookie、任务、上传和下载路径。

## 错误排查日志

旧平台 API 曾记录结构化 `API_REQUEST_FAILED`（5xx、写操作 4xx）和启动阶段的
`API_RUNTIME_UNAVAILABLE`；Pages 服务绑定失败记录 `PAGES_API_BINDING_UNAVAILABLE`。
日志包含服务端生成的 requestId、HTTP 状态、请求方法、脱敏路径、已注册业务码，
常规 API 额外包含耗时和白名单异常分类／数据库或网络错误码。
使用浏览器 Network 的 `X-Request-Id`（也在响应 `request_id` 中）关联 CloudBase 函数日志。
浏览器控制台同时记录失败请求元数据；断网没有服务端回执时记录 `API_NETWORK_FAILED`。
正常未登录的 GET 401 不作为异常告警记录，避免匿名会话检查刷屏。
Pages 对有限 JSON 响应完整读取并校验后再转发；不缓冲 SSE 或图片下载。
无法解析时记录 `PAGES_API_INVALID_JSON` 与字节数并返回结构化 503；前端解析失败
记录 `API_RESPONSE_INVALID_JSON`，提示重新查询，不自动重新提交付费任务。

禁止记录请求／响应正文、密码、Cookie、Token、提示词、图片内容及签名链接；查询参数和
路径中的动态标识不写入日志。日志不能单独证明上游付费任务失败，仍须按任务状态核对。
