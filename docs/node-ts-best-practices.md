# Node + TypeScript 最佳实践

本文是 Agent 开发时必须遵守的规范。目录和分层规则适用于 `apps/api`、`apps/worker` 和 `packages/*`，[中文注释](#中文注释)规则适用于全仓。

工具规则见[代码质量约束](code-quality.md)，模块清单见 [PROJECT_STRUCTURE](../PROJECT_STRUCTURE.md)。鉴权、付费任务、外部调用和日志的硬性要求见根目录 [AGENTS.md](../AGENTS.md)。`PROJECT_STRUCTURE` 的“服务端模块约定”与本文不一致时，以本文为准。

## 基本原则

先按业务分目录，业务内部再分层。

Node 官方没有规定项目结构，这是社区的常见做法。`features` 只是普通目录名，不是框架要求。

这样做的好处：

- 改一个功能时，相关代码都在同一个目录。
- 删除功能时，影响范围清楚。
- 业务之间的依赖容易看出来。

代价是共用代码的归属要想清楚。放错位置后，业务目录会慢慢变成杂物间。

## 代码放在哪里

| 代码                       | 位置                                                        | 要求                                                      |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| 主站入口                   | `apps/api/src/cloudflare.ts`、`cloudflare-app.ts`           | 只组装依赖，不写业务逻辑                                  |
| 图片消费者入口             | `apps/worker/src/cloudflare.ts`                             | 只组装依赖，不写业务逻辑                                  |
| 本地入口                   | `apps/api/src/index.ts`                                     | 只用于隔离开发，不是生产备用入口                          |
| 应用组装                   | `apps/api/src/app.ts`                                       | 注册中间件和错误处理，挂载业务路由                        |
| 配置和全局诊断             | `apps/api/src/env.ts`、`request-diagnostics.ts`             | 不放业务逻辑                                              |
| HTTP 路由                  | `apps/api/src/features/<domain>/routes.ts`                  | 路由多时拆成 `<topic>-routes.ts`，由 `routes.ts` 统一注册 |
| 业务用例                   | `apps/api/src/features/<domain>/service.ts`                 | 逻辑只有一两行时可以不建                                  |
| 数据库读写                 | `packages/db/src/<domain>-repository.ts`                    | API 和 worker 共用，不放进 `features`                     |
| 前后端共用的类型和校验     | `packages/contracts`                                        | 不引入服务端模块和密钥                                    |
| 后台任务                   | `apps/worker/src`                                           | 不依赖 HTTP 请求或浏览器连接                              |
| 模型供应商、队列、对象存储 | `packages/generation`、`packages/queue`、`packages/storage` | 放 API 和 worker 共用的基础能力                           |

`<domain>` 用业务名词，比如 `auth`、`images`、`videos`。服务端不要新建 `utils`、`common`、`helpers` 这类目录。只有一个业务用的代码放在该业务目录里，API 和 worker 都用的代码放进 `packages/`。

## 依赖方向

依赖只能从左往右：

```text
入口文件 → app.ts → features/<domain> → packages/*
```

规则：

- `features` 不引用 `app.ts` 和入口文件。
- `packages` 不引用 `apps`。
- 业务之间尽量不互相引用。确实需要时，引用对方的 `service.ts` 或专门的共享文件，不引用路由文件。
- 只有入口文件可以跨 app 组装。生产环境拆为主站与图片消费者：`apps/api/src/cloudflare.ts` 的默认入口只提供 `fetch`，并导出 `RealtimeHub` DO 类，`apps/worker/src/cloudflare.ts` 导出 `queue` 和 `scheduled`。`cloudflare-app.ts` 可以引用 `apps/worker/src/cloudflare-runtime.ts` 复用调用级依赖组装，不得从主站入口引用或执行消费者。
- `apps/worker/scripts` 的验证脚本可以引用 `createApp`。

## 每层的职责

| 层           | 负责                                       | 不做                              |
| ------------ | ------------------------------------------ | --------------------------------- |
| `routes.ts`  | 解析身份、校验输入、调用业务代码、返回响应 | 写 SQL 和计费流程                 |
| `service.ts` | 组织业务用例，调用仓储和外部依赖           | 读取 Hono `Context`，拼 HTTP 响应 |
| 仓储         | 读写数据库，按组织或用户限定数据范围       | 编排业务流程，在事务里发网络请求  |

写代码时遵守：

- 路由处理函数写在路由定义旁边，不另建 `controllers/`。Hono 官方这样建议，否则路径参数的类型推断不出来。
- 每个业务导出一个返回 `Hono` 实例的函数，在 `app.ts` 用 `app.route()` 挂载。
- 依赖通过函数参数传入，比如 `videoService(deps)`。不在模块顶层创建数据库或存储客户端，import 时不发网络请求。
- 外部输入先当作 `unknown`，用 Zod 校验后再使用。
- JSON 响应的外层结构由 `createApp` 统一处理，路由不要再包一层，见[返回规范](api-response.md)。
- 不要为几行纯函数加依赖注入层或类继承。

## 新增业务功能

最小完整示例是 `apps/api/src/features/videos/`。按这个顺序做：

1. 前后端共用的类型和校验写进 `packages/contracts`。
2. 数据库读写写进 `packages/db/src/<domain>-repository.ts`，并从 `packages/db/src/index.ts` 导出。涉及表结构时先读 [packages/db/AGENTS.md](../packages/db/AGENTS.md)。
3. 业务用例写进 `features/<domain>/service.ts`。
4. 路由写进 `features/<domain>/routes.ts`。
5. 在 `app.ts` 挂载路由，在入口文件组装依赖。
6. 用 Hono 的 `app.request` 写测试。测试放在被测文件旁边，覆盖鉴权、数据归属、输入校验和失败情况。
7. 运行 `pnpm check` 和 `git diff --check`。

## 中文注释

代码必须有简洁的中文注释。这个仓库的代码主要由 AI 编写，也是项目负责人的学习材料，所以注释要让人看懂这段代码的用途和原因。

规则适用于全仓新增或修改的手写代码，包括前端和脚本。

`pnpm lint`、提交钩子和 CI 会自动检查 TS、TSX、MJS 文件里改过的代码，见[中文注释检查](code-quality.md#中文注释检查)。工具只能判断语言、长度和导出声明有没有注释，判断不了注释写得好不好。CSS、SQL 和 YAML 的注释也要用中文，这部分靠自查。

### 必须写注释的地方

| 位置                         | 写什么                   |
| ---------------------------- | ------------------------ |
| 导出的函数、类和 React 组件  | 一行说明业务用途         |
| 不直观的判断、正则和数字     | 为什么这样写             |
| 扣费、幂等、权限、重试、超时 | 这段代码保护什么业务规则 |
| 故意忽略错误、兼容旧数据     | 为什么可以这样做         |

### 写法

- 导出项用 `/** ... */`，编辑器悬停时能直接看到。函数内部用 `//`。
- 优先一行，最多三行。说不完的内容写进 `docs/`。
- 写用途和原因，不复述代码。
- 标识符、错误码、文件名和 API 名称保留英文。
- 修改代码时同步修改注释，不留下过期说明。

不要在注释里写修改历史，git 已有记录。也不要写密钥、提示词、用户内容和签名地址，或把未实现的功能写成已完成。

正确示例：

```ts
/** 从 Bearer 令牌或 Cookie 解析当前登录会话，无效时返回 null。 */
export async function enterprisePrincipal(c: Context, auth: EnterpriseAuth) {
  // ...
}

await deps.wake?.().catch(() => {
  // 唤醒失败不影响已受理的任务，持久 outbox 之后还会被处理。
});
```

错误示例：

```ts
// 解析输入
const input = videoCreateSchema.parse(raw);

// Read the request body.
const body: unknown = await c.req.json();
```

### 旧代码

现有注释大多还是英文。按改动范围处理：

- 修改一个顶层函数、类或变量时，把它里面的注释改成中文，并补齐上面要求的注释。
- 不要为了翻译注释单独批量修改无关文件。

`biome-ignore` 这类工具指令、第三方代码、生成文件和已合并的数据库迁移不受这条规则约束。测试的 `it()` 标题不算注释。

## 不要照抄的现有写法

| 位置                               | 问题                                                                       | 新代码怎么做                                   |
| ---------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `features/images`                  | 混入了积分钱包（`wallet-routes.ts`）和视频分镜（`storyboard-planner.ts`）  | 新业务建自己的目录，不继续往这里放             |
| `features/auth/routes.ts`          | 共享的 `enterprisePrincipal` 放在路由文件里，`images` 和 `videos` 都引用它 | 可以继续调用它，但新的共享函数不要放进路由文件 |
| `PROJECT_STRUCTURE` 的模块约定     | 写着 repository 放在 `features`，实际在 `packages/db/src`                  | 以本文为准                                     |
| `PROJECT_STRUCTURE` 的模型配置说明 | 指向 `features/model-management`，但仓库里没有这个模块                     | 不要按这条说明找代码                           |

## 提交前自查

`pnpm check` 会运行 lint、类型检查、测试和构建，具体规则见[代码质量约束](code-quality.md)。工具目前查不了下面这些，提交前要自己确认：

- 新代码放在正确的目录。
- 路由里没有 SQL 和计费流程。
- 没有反向依赖。
- 注释写的是用途和原因，没有复述代码。
- 不直观的逻辑，以及扣费、幂等、权限、重试、超时相关的代码都写了原因。

## 参考资料

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)：第 1 节讲按业务组件组织代码，以及组件内部分层。
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)：讲路由拆分，以及为什么不写 Rails 风格的 controller。
