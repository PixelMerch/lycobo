# TypeScript 与 Node 学习文档

目标是看懂这个项目的后端代码，判断 AI 的改动对不对。不追求从零搭项目。

这是商业项目，学习时只读代码，不在仓库里写练习代码。想动手试语法，用 [TypeScript 在线练习场](https://www.typescriptlang.org/play/)。

时长按每天约 1 小时估算，并假设你写过一点代码。完全没写过代码的话，第 1 阶段的时间翻倍。

| 阶段 | 内容       | 大约时长 | 学完能做什么                         |
| ---- | ---------- | -------- | ------------------------------------ |
| 1    | JavaScript | 2–3 周   | 看懂一个函数在做什么                 |
| 2    | TypeScript | 1–2 周   | 看懂类型和编译报错                   |
| 3    | Node 后端  | 3–4 周   | 看懂接口、数据库和后台任务           |
| 4    | 串起来     | 1 周     | 讲清一次生成请求在后端经过了哪些代码 |

页面（React）暂缓，内容放在文末，现在不用看。

## 仓库地图

| 目录                  | 是什么                               | 对应阶段 |
| --------------------- | ------------------------------------ | -------- |
| `packages/contracts`  | 前后端共用的数据定义                 | 2        |
| `apps/api`            | 接口服务                             | 3        |
| `apps/worker`         | 后台消费者，负责调模型生成图片和视频 | 3        |
| `packages/db`         | 数据库读写                           | 3        |
| `packages/generation` | 调用模型服务                         | 3        |
| `packages/storage`    | 保存图片和视频                       | 3        |
| `apps/web`            | 浏览器里的页面                       | 暂缓     |

## 怎么读代码

先学会编辑器的三个动作，读代码全靠它们：

- 鼠标悬停在变量上，看它的类型。
- 按住 Cmd 点击名字，跳到定义。
- 全局搜索函数名，看谁在用它。

每次学习可以这样分配：30 分钟看教程，30 分钟读下面列出的例子。读不懂的地方直接问 AI，方法见“怎么配合 AI 学”。

## 第 1 阶段：JavaScript

TypeScript 就是 JavaScript 加上类型，所以先学 JavaScript。

教程用[现代 JavaScript 教程](https://zh.javascript.info/)，只看这几章：[基础知识](https://zh.javascript.info/first-steps)、[对象](https://zh.javascript.info/object-basics)、[数组方法](https://zh.javascript.info/array-methods)、[解构赋值](https://zh.javascript.info/destructuring-assignment)、[Promise 和 async/await](https://zh.javascript.info/async)、[模块](https://zh.javascript.info/modules)。

下面的例子按从易到难排列：

| 概念                           | 看哪里                                                              | 看什么                                          |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| 函数、条件判断、数组下标       | [reference-type.ts](../packages/generation/src/reference-type.ts)   | 只看文件开头几个字节，就能判断图片格式          |
| 类和继承                       | [provider-errors.ts](../packages/generation/src/provider-errors.ts) | 自定义错误怎么多带几个字段                      |
| 字符串方法、`some`、箭头函数   | [core.ts](../packages/storage/src/core.ts) 的 `objectKeySchema`     | 怎么判断一个存储路径是否安全                    |
| `async`、`await`、正则、可选链 | [password.ts](../apps/api/src/features/auth/password.ts)            | 密码怎么加密保存，登录时怎么比对                |
| `Map`、Promise                 | [provider-references.ts](../apps/worker/src/provider-references.ts) | 用 Map 做缓存，读取失败时把缓存删掉             |
| 闭包、`try`/`finally`          | [slots.ts](../apps/worker/src/slots.ts)                             | 17 行代码限制同时运行的任务数，放到本阶段最后看 |

**学完自查：** 能逐行讲清 `reference-type.ts` 和 `password.ts`。

## 第 2 阶段：TypeScript

教程用官方手册，只看这几章：[常用类型](https://www.typescriptlang.org/zh/docs/handbook/2/everyday-types.html)、[类型收窄](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)、[函数](https://www.typescriptlang.org/docs/handbook/2/functions.html)、[对象类型](https://www.typescriptlang.org/docs/handbook/2/objects.html)、[泛型](https://www.typescriptlang.org/docs/handbook/2/generics.html)。泛型先会读就行。

外部数据的校验再看 [Zod 基础](https://zod.dev/basics)。这个项目大量使用它。

| 概念                       | 看哪里                                                                                 | 看什么                               |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| 联合类型                   | [wallet-repository.ts](../packages/db/src/wallet-repository.ts) 的 `appendWalletEntry` | `kind` 只能取列出的几个值            |
| `interface`                | [core.ts](../packages/storage/src/core.ts) 的 `ImageStore`                             | 只规定能做什么，不管怎么实现         |
| `Pick`                     | [provider-references.ts](../apps/worker/src/provider-references.ts)                    | 函数只要求对方提供 `read` 这一个能力 |
| `as const`、`keyof typeof` | [image-variants.ts](../packages/storage/src/image-variants.ts)                         | 从一个值推导出类型                   |
| `unknown` 和类型收窄       | [api-response.ts](../packages/contracts/src/api-response.ts) 的 `unwrapApiData`        | 外部数据先当未知，判断之后才能用     |
| 泛型                       | [slots.ts](../apps/worker/src/slots.ts) 的 `<T>`                                       | 任务返回什么类型，结果就是什么类型   |
| Zod 定义数据               | [wallet.ts](../packages/contracts/src/wallet.ts)                                       | 一份定义，前后端共用                 |
| 从 Zod 推导类型            | [queue 的 index.ts](../packages/queue/src/index.ts) 的 `ImageQueueJob`                 | `z.infer` 让类型和校验保持一致       |

**学完自查：** 能说清 `any`、`unknown` 和 `as` 的区别，能看懂[代码质量约束](code-quality.md)里每条规则为什么存在。

## 第 3 阶段：Node 后端

教程先看 Node 官方的[入门介绍](https://nodejs.org/zh-cn/learn/getting-started/introduction-to-nodejs)、[阻塞与非阻塞](https://nodejs.org/zh-cn/learn/asynchronous-work/overview-of-blocking-vs-non-blocking)和[环境变量](https://nodejs.org/zh-cn/learn/command-line/how-to-read-environment-variables-from-nodejs)。接口框架看 Hono 的[基础](https://hono.dev/docs/getting-started/basic)、[中间件](https://hono.dev/docs/guides/middleware)和[测试](https://hono.dev/docs/guides/testing)。数据库看 PostgreSQL 教程的 [SQL 语言](https://www.postgresql.org/docs/current/tutorial-sql.html)和[事务](https://www.postgresql.org/docs/current/tutorial-transactions.html)。

| 概念         | 看哪里                                                                                                                                                                  | 看什么                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 环境变量     | [env.ts](../apps/api/src/env.ts)                                                                                                                                        | 配置也要校验，不能直接信任           |
| 启动与退出   | [index.ts](../apps/api/src/index.ts) 的末尾                                                                                                                             | 服务收到停止信号时怎么安全关闭       |
| 路由和中间件 | [app.ts](../apps/api/src/app.ts)                                                                                                                                        | 请求进来先经过哪些步骤               |
| 分层         | [视频 routes](../apps/api/src/features/videos/routes.ts) → [service](../apps/api/src/features/videos/service.ts) → [repository](../packages/db/src/video-repository.ts) | 路由管请求，服务管业务，仓储管数据库 |
| SQL 和事务   | [wallet-repository.ts](../packages/db/src/wallet-repository.ts) 的 `appendWalletEntry`                                                                                  | 积分怎么防止重复扣、扣成负数         |
| 接口测试     | [app.test.ts](../apps/api/src/app.test.ts)                                                                                                                              | 不启动服务也能测接口                 |
| 后台任务     | [local-consumer.ts](../apps/worker/src/local-consumer.ts)                                                                                                               | 一个循环不断取任务来做               |
| 文件和子进程 | [check-code-quality.mjs](../scripts/check-code-quality.mjs)                                                                                                             | Node 怎么读文件、运行其他命令        |

这个项目反复用到三个后端概念，要真正理解：

| 概念   | 意思                                     | 为什么需要                   |
| ------ | ---------------------------------------- | ---------------------------- |
| 事务   | 一组数据库操作要么全部成功，要么全部撤销 | 否则可能扣了积分却没创建任务 |
| 幂等   | 同一个请求发多次，效果和发一次一样       | 网络抖动重试时不能重复收费   |
| Outbox | 先把“要做的事”写进数据库，再由后台去做   | 服务重启时任务不会丢         |

**学完自查：** 能讲清一个请求从进入 API 到写入数据库的过程，能说明为什么付费的模型调用不放在接口里直接做。

## 第 4 阶段：跟一次生成请求

用户点“立即生成”后，后端依次走过下面这些地方。对照着读一遍，前面学的内容就都串起来了。读代码就够了，不需要真的点生成，本地生图也会调用真实模型服务，产生费用。

| 步骤 | 发生了什么                          | 代码                                                                                                           |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | 接口收到请求，校验参数              | [routes.ts](../apps/api/src/features/images/routes.ts) 的 `app.post("/image-tasks")`                           |
| 2    | 一个事务里扣积分、建任务、写 outbox | [image-repository.ts](../packages/db/src/image-repository.ts) 的 `create`                                      |
| 3    | 接口立刻返回，并唤醒后台消费者      | 第 1 步里的 `deps.wake`                                                                                        |
| 4    | 消费者领取任务                      | [cloudflare-consumer.ts](../apps/worker/src/cloudflare-consumer.ts) 的 `consumeCloudflareImages`               |
| 5    | 锁定这张图，准备生成                | [image-processor.ts](../apps/worker/src/image-processor.ts) 的 `processImageItem`                              |
| 6    | 调用模型服务                        | [configured-provider.ts](../packages/generation/src/configured-provider.ts) 的 `configuredProviderCall`        |
| 7    | 保存图片，结束任务                  | [configured-image-processor.ts](../apps/worker/src/configured-image-processor.ts) 里的 `store.put` 和 `finish` |
| 8    | 浏览器来查询时，接口返回结果        | [routes.ts](../apps/api/src/features/images/routes.ts) 的 `app.get("/image-tasks/status")`                     |

**学完自查：** 不看表格，把这条链路讲给 AI 听，让它指出讲错和漏掉的地方。再回答两个问题：第 2 步如果拆成三次独立的数据库操作，会出什么问题？第 6 步失败时，积分怎么退回？

## 怎么配合 AI 学

读代码时可以这样问：

- 我学到第 N 阶段了，按这个水平逐行解释这个文件。
- 这一行去掉会发生什么？
- 用这个项目里的例子，给我出 3 道关于这个概念的小题。

AI 改完代码后，用这份清单检查，这也是学习的最终目的：

1. 让它解释这次 diff：改了什么，为什么这样改，有没有更简单的写法。
2. `pnpm check` 过了吗？
3. 有没有动 `scripts/code-quality-baseline.json`、`biome.json`，或者加抑制注释？这些通常是在绕开规则。
4. 改动范围和需求对得上吗？有没有顺手改了无关的地方？
5. 这个行为有测试吗？

## 暂缓：React（页面）

这部分现在不用看。以后要学页面时再回来，时长约 3–4 周，学完能看懂页面代码。

教程用[官方中文文档](https://zh-hans.react.dev/learn)，按顺序看：[描述 UI](https://zh-hans.react.dev/learn/describing-the-ui)、[添加交互](https://zh-hans.react.dev/learn/adding-interactivity)、[状态管理](https://zh-hans.react.dev/learn/managing-state)、[脱围机制](https://zh-hans.react.dev/learn/escape-hatches)。最后一定要看[你可能不需要 Effect](https://zh-hans.react.dev/learn/you-might-not-need-an-effect)。

React 学会后，再看这个项目用到的三个库：[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/quick-start) 管服务端数据，[Zustand](https://zustand.docs.pmnd.rs/) 管页面交互状态，[React Router](https://reactrouter.com/start/modes) 管路由。

| 概念                  | 看哪里                                                                                                 | 看什么                           |
| --------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 组件和 props          | [credit-coin.tsx](../apps/web/src/components/credit-coin.tsx)                                          | 最小的组件长什么样               |
| 列表渲染、点击事件    | [workspace-tool-picker.tsx](../apps/web/src/features/workspace/workspace-tool-picker.tsx)              | 工具坞怎么由一个数组渲染出来     |
| state                 | [collapsible-text.tsx](../apps/web/src/components/collapsible-text.tsx) 的 `expanded`                  | 状态变化后页面怎么更新           |
| `useEffect`、`useRef` | [collapsible-text.tsx](../apps/web/src/components/collapsible-text.tsx)                                | 怎么和浏览器打交道，用完怎么清理 |
| 条件渲染、懒加载      | [account-overlays.tsx](../apps/web/src/features/account/account-overlays.tsx)                          | 弹窗什么时候显示，什么时候才加载 |
| 自定义 Hook           | [use-home-header-surface.ts](../apps/web/src/features/home/use-home-header-surface.ts)                 | 把一段逻辑从组件里抽出来         |
| Zustand               | [account-overlay-store.ts](../apps/web/src/features/account/account-overlay-store.ts)                  | 多个组件共用一份状态             |
| 读取接口数据          | [wallet-client.ts](../apps/web/src/features/account/wallet-client.ts) 的 `useWallet`                   | `queryKey` 的作用，数据缓存在哪  |
| 提交数据              | [generation-client.ts](../apps/web/src/features/generation/generation-client.ts) 的 `useGenerateImage` | 这个比较长，放到最后看           |
| 路由                  | [router.tsx](../apps/web/src/app/router.tsx)                                                           | 网址怎么对应到页面               |

按钮、弹窗这类控件都来自 HeroUI，见 [HeroUI 组件清单](heroui-components.md)。颜色和尺寸规则见 [DESIGN.md](../DESIGN.md)。

**学完自查：** 能说清 props 和 state 的区别，什么时候需要 `useEffect`，什么时候不需要；能讲清 `workspace-tool-picker.tsx` 和 `collapsible-text.tsx` 的全部代码。
