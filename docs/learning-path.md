# TypeScript、Node、React 学习路线

目标是看懂这个仓库的代码，判断 AI 的改动对不对，自己能做小改动。不追求从零搭项目。

时长按每天约 1 小时估算，并假设你写过一点代码。完全没写过代码的话，第 1 阶段的时间翻倍。

| 阶段 | 内容 | 大约时长 | 学完能做什么 |
| --- | --- | --- | --- |
| 准备 | 练习环境 | 半天 | 放心改代码，不影响线上和正在工作的 AI |
| 1 | JavaScript | 2–3 周 | 看懂一个函数在做什么 |
| 2 | TypeScript | 1–2 周 | 看懂类型和编译报错 |
| 3 | React | 3–4 周 | 看懂页面代码，改文案、加小组件 |
| 4 | Node 后端 | 3–4 周 | 看懂接口、数据库和后台任务 |
| 5 | 串起来 | 1 周 | 讲清一次“点击生成”经过了哪些代码 |

React 放在 Node 前面，是因为 `apps/web` 占了仓库一半以上的代码，而且改完马上能在页面上看到效果，反馈最快。

## 仓库地图

| 目录 | 是什么 | 对应阶段 |
| --- | --- | --- |
| `apps/web` | 浏览器里的页面 | 3 |
| `apps/api` | 接口服务 | 4 |
| `apps/worker` | 后台消费者，负责调模型生成图片和视频 | 4 |
| `packages/contracts` | 前后端共用的数据定义 | 2 |
| `packages/db` | 数据库读写 | 4 |
| `packages/generation` | 调用模型服务 | 4 |
| `packages/storage` | 保存图片和视频 | 4 |

## 准备：练习环境

这个目录经常有 AI 在工作，所以练习放在单独的副本里。副本没有 `.env`，碰不到线上服务，也不会产生费用。在仓库目录下运行：

```sh
git worktree add ../lycoboai-learn -b learn/practice dev
cd ../lycoboai-learn
pnpm install --frozen-lockfile
```

之后的练习命令都在 `../lycoboai-learn` 里运行，第 6 个练习除外。改乱了就还原，新建的文件手动删掉：

```sh
git restore .
```

先学会编辑器的三个动作，读代码全靠它们：

- 鼠标悬停在变量上，看它的类型。
- 按住 Cmd 点击名字，跳到定义。
- 全局搜索函数名，看谁在用它。

每次学习可以这样分配：20 分钟看教程，30 分钟读仓库里的例子，10 分钟做练习。读不懂的地方直接问 AI，方法见文末。

## 第 1 阶段：JavaScript

TypeScript 就是 JavaScript 加上类型，所以先学 JavaScript。

教程用[现代 JavaScript 教程](https://zh.javascript.info/)，只看这几章：[基础知识](https://zh.javascript.info/first-steps)、[对象](https://zh.javascript.info/object-basics)、[数组方法](https://zh.javascript.info/array-methods)、[解构赋值](https://zh.javascript.info/destructuring-assignment)、[Promise 和 async/await](https://zh.javascript.info/async)、[模块](https://zh.javascript.info/modules)。

| 概念 | 看哪里 | 看什么 |
| --- | --- | --- |
| 函数、字符串、正则 | [prompt-description.ts](../apps/web/src/features/generation/references/prompt-description.ts) | 只有 5 行，判断提示词里有没有真正的文字 |
| `find`、可选链 `?.`、`??`、`\|\|` | [model-display-name.ts](../apps/web/src/features/generation/models/model-display-name.ts) | 找不到模型名时怎么一层层退回默认值 |
| `async`、`await`、`try`/`catch` | [clipboard.ts](../apps/web/src/lib/clipboard.ts) | 异步操作成功和失败分别怎么处理 |
| `map`、`flatMap`、展开 `...` | [task-sync.ts](../apps/web/src/features/generation/task-sync.ts) 的 `replaceJob` | 怎么不改原数组，得到一份更新后的新数据 |

**练习 1：运行自己的代码。** 新建 `practice/hello.ts`，写一个积分数组，用 `reduce` 算出总数并打印，然后运行：

```sh
node practice/hello.ts
```

**练习 2：运行测试。** 打开 [prompt-description.test.ts](../apps/web/src/features/generation/references/prompt-description.test.ts)，先猜每个用例为什么通过，再各加一个你认为应该通过和应该被拒绝的提示词：

```sh
pnpm exec vitest run apps/web/src/features/generation/references/prompt-description.test.ts
```

**过关标准：** 能逐行讲清 `model-display-name.ts` 和 `clipboard.ts`。

## 第 2 阶段：TypeScript

教程用官方手册，只看这几章：[常用类型](https://www.typescriptlang.org/zh/docs/handbook/2/everyday-types.html)、[类型收窄](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)、[函数](https://www.typescriptlang.org/docs/handbook/2/functions.html)、[对象类型](https://www.typescriptlang.org/docs/handbook/2/objects.html)、[泛型](https://www.typescriptlang.org/docs/handbook/2/generics.html)。泛型先会读就行。想试语法可以用[在线练习场](https://www.typescriptlang.org/play/)。

外部数据的校验再看 [Zod 基础](https://zod.dev/basics)。这个仓库大量使用它。

| 概念 | 看哪里 | 看什么 |
| --- | --- | --- |
| 对象类型、默认值 | [ui-icon.tsx](../apps/web/src/components/ui-icon.tsx) | 函数参数的类型怎么写 |
| `as const`、`keyof typeof` | [ui-icon.tsx](../apps/web/src/components/ui-icon.tsx) 的 `sizes` | 从一个值推导出类型 |
| 联合类型、`Record` | [account-overlay-store.ts](../apps/web/src/features/account/account-overlay-store.ts) | `"center" \| "dialog"` 限定只能取哪些值 |
| 类型收窄 | [model-capabilities.ts](../apps/web/src/features/generation/models/model-capabilities.ts) | 判断之后，TypeScript 怎么知道类型变了 |
| `unknown` | [api-response.ts](../apps/web/src/lib/api-response.ts) | 外部数据先当未知，校验后才能用 |
| Zod 定义数据 | [wallet.ts](../packages/contracts/src/wallet.ts) | 一份定义，前后端共用 |
| 从 Zod 推导类型 | [variation-plan.ts](../packages/contracts/src/variation-plan.ts) | `z.infer` 让类型和校验保持一致 |

**练习 3：读懂报错。** 把 `prompt-description.ts` 最后一行改成 `return description.length;`，运行下面的命令，读懂报错后还原：

```sh
pnpm --filter @lycoboai/web typecheck
```

你会看到 `Type 'number' is not assignable to type 'boolean'`，也就是函数声明返回布尔值，实际却返回了数字。

**练习 4：校验数据。** 新建 `packages/contracts/practice-wallet.ts`，运行后第一行打印 `true`，第二行打印 `false`，因为余额不能为负：

```ts
import { walletBalanceSchema } from "./src/wallet.ts";

console.log(walletBalanceSchema.safeParse({ balance: 100, unitCredits: 2 }).success);
console.log(walletBalanceSchema.safeParse({ balance: -1, unitCredits: 2 }).success);
```

```sh
node packages/contracts/practice-wallet.ts
```

**过关标准：** 能说清 `any`、`unknown` 和 `as` 的区别，能看懂[代码质量约束](code-quality.md)里每条规则为什么存在。

## 第 3 阶段：React

教程用[官方中文文档](https://zh-hans.react.dev/learn)，按顺序看：[描述 UI](https://zh-hans.react.dev/learn/describing-the-ui)、[添加交互](https://zh-hans.react.dev/learn/adding-interactivity)、[状态管理](https://zh-hans.react.dev/learn/managing-state)、[脱围机制](https://zh-hans.react.dev/learn/escape-hatches)。最后一定要看[你可能不需要 Effect](https://zh-hans.react.dev/learn/you-might-not-need-an-effect)。

React 学会后，再看这个仓库用到的三个库：[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/quick-start) 管服务端数据，[Zustand](https://zustand.docs.pmnd.rs/) 管页面交互状态，[React Router](https://reactrouter.com/start/modes) 管路由。

| 概念 | 看哪里 | 看什么 |
| --- | --- | --- |
| 组件和 props | [credit-coin.tsx](../apps/web/src/components/credit-coin.tsx) | 最小的组件长什么样 |
| 列表渲染、点击事件 | [workspace-tool-picker.tsx](../apps/web/src/features/workspace/workspace-tool-picker.tsx) | 工具坞怎么由一个数组渲染出来 |
| state | [collapsible-text.tsx](../apps/web/src/components/collapsible-text.tsx) 的 `expanded` | 状态变化后页面怎么更新 |
| `useEffect`、`useRef` | [collapsible-text.tsx](../apps/web/src/components/collapsible-text.tsx) | 怎么和浏览器打交道，用完怎么清理 |
| 条件渲染、懒加载 | [account-overlays.tsx](../apps/web/src/features/account/account-overlays.tsx) | 弹窗什么时候显示，什么时候才加载 |
| 自定义 Hook | [use-home-header-surface.ts](../apps/web/src/features/home/use-home-header-surface.ts) | 把一段逻辑从组件里抽出来 |
| Zustand | [account-overlay-store.ts](../apps/web/src/features/account/account-overlay-store.ts) | 多个组件共用一份状态 |
| 读取接口数据 | [wallet-client.ts](../apps/web/src/features/account/wallet-client.ts) 的 `useWallet` | `queryKey` 的作用，数据缓存在哪 |
| 提交数据 | [generation-client.ts](../apps/web/src/features/generation/generation-client.ts) 的 `useGenerateImage` | 这个比较长，放到本阶段最后看 |
| 路由 | [router.tsx](../apps/web/src/app/router.tsx) | 网址怎么对应到页面 |

按钮、弹窗这类控件都来自 HeroUI，见 [HeroUI 组件清单](heroui-components.md)。颜色和尺寸规则见 [DESIGN.md](../DESIGN.md)。

**练习 5：改页面。** 启动前端，打开 <http://127.0.0.1:5190/>。首页不登录也能看：

```sh
pnpm --filter @lycoboai/web exec vite --host 127.0.0.1 --port 5190
```

然后依次做这三件事，都在 [home-inspiration-gallery.tsx](../apps/web/src/features/home/home-inspiration-gallery.tsx) 里：

1. 改掉文案“挑一个喜欢的风格，一键做同款”，看页面自动刷新。
2. 把 `useState<InspirationCategory>("全部")` 的默认值改成 `"家纺展示"`，看默认选中的分类变化。
3. 新建一个计数器组件，点一次按钮数字加一，放到这个页面上。

**过关标准：** 能说清 props 和 state 的区别，什么时候需要 `useEffect`，什么时候不需要；能讲清 `workspace-tool-picker.tsx` 和 `collapsible-text.tsx` 的全部代码。

## 第 4 阶段：Node 后端

教程先看 Node 官方的[入门介绍](https://nodejs.org/zh-cn/learn/getting-started/introduction-to-nodejs)、[阻塞与非阻塞](https://nodejs.org/zh-cn/learn/asynchronous-work/overview-of-blocking-vs-non-blocking)和[环境变量](https://nodejs.org/zh-cn/learn/command-line/how-to-read-environment-variables-from-nodejs)。接口框架看 Hono 的[基础](https://hono.dev/docs/getting-started/basic)、[中间件](https://hono.dev/docs/guides/middleware)和[测试](https://hono.dev/docs/guides/testing)。数据库看 PostgreSQL 教程的 [SQL 语言](https://www.postgresql.org/docs/current/tutorial-sql.html)和[事务](https://www.postgresql.org/docs/current/tutorial-transactions.html)。

| 概念 | 看哪里 | 看什么 |
| --- | --- | --- |
| 环境变量 | [env.ts](../apps/api/src/env.ts) | 配置也要校验，不能直接信任 |
| 启动与退出 | [index.ts](../apps/api/src/index.ts) 的末尾 | 服务收到停止信号时怎么安全关闭 |
| 路由和中间件 | [app.ts](../apps/api/src/app.ts) | 请求进来先经过哪些步骤 |
| 分层 | [视频 routes](../apps/api/src/features/videos/routes.ts) → [service](../apps/api/src/features/videos/service.ts) → [repository](../packages/db/src/video-repository.ts) | 路由管请求，服务管业务，仓储管数据库 |
| SQL 和事务 | [wallet-repository.ts](../packages/db/src/wallet-repository.ts) 的 `appendWalletEntry` | 积分怎么防止重复扣、扣成负数 |
| 接口测试 | [app.test.ts](../apps/api/src/app.test.ts) | 不启动服务也能测接口 |
| 后台任务 | [local-consumer.ts](../apps/worker/src/local-consumer.ts) | 一个循环不断取任务来做 |
| 文件和子进程 | [check-code-quality.mjs](../scripts/check-code-quality.mjs) | Node 怎么读文件、运行其他命令 |

这个项目反复用到三个后端概念，要真正理解：

| 概念 | 意思 | 为什么需要 |
| --- | --- | --- |
| 事务 | 一组数据库操作要么全部成功，要么全部撤销 | 否则可能扣了积分却没创建任务 |
| 幂等 | 同一个请求发多次，效果和发一次一样 | 网络抖动重试时不能重复收费 |
| Outbox | 先把“要做的事”写进数据库，再由后台去做 | 服务重启时任务不会丢 |

**练习 6：查数据库。** 这一步在原来的仓库目录下运行，需要本地 Docker 在运行。本地库是线上快照，只查询，不要修改：

```sh
docker compose exec -T postgres psql -U lycoboai -d lycoboai -c "select kind, count(*) from wallet_entries group by kind order by kind;"
```

**练习 7：加一个接口。** 在 `app.ts` 的 `/api/health/live` 下面加一行：

```ts
app.get("/api/practice/hello", (c) => c.json({ greeting: "你好" }));
```

再仿照 `app.test.ts` 第一个用例，写一个测试请求它，确认状态码是 200：

```sh
pnpm exec vitest run apps/api/src/app.test.ts
```

**过关标准：** 能讲清一个请求从进入 API 到写入数据库的过程，能说明为什么付费的模型调用不放在接口里直接做。

## 第 5 阶段：跟一次“点击生成”

用户点一下“立即生成”，代码依次走过下面这些地方。对照着读一遍，前面学的内容就都串起来了。

| 步骤 | 发生了什么 | 代码 |
| --- | --- | --- |
| 1 | 页面拿到用户的输入 | [workspace-page.tsx](../apps/web/src/features/generation/workspace-page.tsx) |
| 2 | 上传参考图，再带上幂等编号发请求 | [generation-client.ts](../apps/web/src/features/generation/generation-client.ts) 的 `useGenerateImage` |
| 3 | 接口校验参数 | [routes.ts](../apps/api/src/features/images/routes.ts) 的 `app.post("/image-tasks")` |
| 4 | 一个事务里扣积分、建任务、写 outbox | [image-repository.ts](../packages/db/src/image-repository.ts) 的 `create` |
| 5 | 接口立刻返回，并唤醒后台消费者 | 同第 3 步的 `deps.wake` |
| 6 | 消费者领取任务 | [cloudbase-outbox.ts](../apps/worker/src/cloudbase-outbox.ts) 的 `drainCloudBaseOutbox` |
| 7 | 锁定这张图，准备生成 | [image-processor.ts](../apps/worker/src/image-processor.ts) 的 `processImageItem` |
| 8 | 调用模型服务 | [configured-provider.ts](../packages/generation/src/configured-provider.ts) 的 `configuredProviderCall` |
| 9 | 保存图片，结束任务 | [configured-image-processor.ts](../apps/worker/src/configured-image-processor.ts) 里的 `store.put` 和 `finish` |
| 10 | 页面轮询到结果 | [use-image-events.ts](../apps/web/src/features/generation/use-image-events.ts) 和 [task-sync.ts](../apps/web/src/features/generation/task-sync.ts) |
| 11 | 历史记录显示图片 | [generation-history.tsx](../apps/web/src/features/generation/history/generation-history.tsx) |

**练习 8：讲给 AI 听。** 不看表格，把这条链路讲一遍，让 AI 指出讲错和漏掉的地方。再回答两个问题：第 4 步如果拆成三次独立的数据库操作，会出什么问题？第 8 步失败时，积分怎么退回？

这条链路不需要真的点生成。本地生图也会调用真实模型服务，产生费用。

## 怎么配合 AI 学

练习先自己写，写完再让 AI 看。直接要答案学不到东西。

读代码时可以这样问：

- 我学到第 N 阶段了，按这个水平逐行解释这个文件。
- 这一行去掉会发生什么？
- 用这个仓库里的例子，给我出 3 道关于这个概念的小题。

AI 改完代码后，用这份清单检查，这也是学习的最终目的：

1. 让它解释这次 diff：改了什么，为什么这样改，有没有更简单的写法。
2. `pnpm check` 过了吗？
3. 有没有动 `scripts/code-quality-baseline.json`、`biome.json`，或者加抑制注释？这些通常是在绕开规则。
4. 改动范围和需求对得上吗？有没有顺手改了无关的地方？
5. 这个行为有测试吗？
