# 代码质量约束

这个仓库的代码主要由 AI 编写，以后还要拿来学习 TypeScript、Node 和 React。所以规则尽量交给工具自动执行，不靠人记，代码也要让初学者读得懂。

## 什么时候检查

| 时机 | 范围 | 入口 |
| --- | --- | --- |
| 提交时 | 暂存的文件 | `.githooks/pre-commit` 运行 lint-staged |
| 本地完整检查 | 全仓 | `pnpm lint`，`pnpm check` 已包含 |
| CI | 全仓 | `pnpm check` |

任何一步失败，代码都进不了仓库。Biome 的警告也按失败处理。

## 必须为零的规则

| 规则 | 要求 | 为什么 |
| --- | --- | --- |
| 禁止 `any` | 不用 `any` 绕过类型 | `any` 会关掉类型检查，错误留到运行时才暴露 |
| 禁止 `!` 非空断言 | 不写 `user!.name`，先判断再用 | 它只让编译器不再提醒，值为空时照样崩溃。测试文件除外 |
| 处理每个 Promise | 异步调用要 `await`；确实不等结果就写 `void navigate(path)` | 没人接住的 Promise 失败时，错误会悄悄丢掉 |
| 不给参数重新赋值 | 派生值用新变量 | 同一个名字中途变含义，读代码时容易看错 |
| 没有循环依赖 | A 引用 B，B 不能再引用回 A | 循环依赖会带来加载顺序问题，也说明职责没分清 |
| 没有死文件 | 每个模块都要有人引用 | 没人用的代码只会误导读的人 |
| React Hooks 规则 | 依赖数组写全，Hook 只在顶层调用，组件不定义在组件里 | 这是 React 行为出错的常见来源 |
| 禁止 `console.log` | 业务代码只用 `console.error`、`warn`、`info` | 调试输出不能留到线上，还可能带出敏感内容。脚本和测试除外 |
| 文件名用 kebab-case | `account-menu.tsx` | 全仓统一 |
| 测试不留 `.only` | 提交前去掉 | 否则其他测试会被悄悄跳过 |

TypeScript 使用 strict 模式，并开启 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等选项，见 `tsconfig.base.json`。

## 只减不增的规则

旧代码一次全改风险太大，所以用棘轮：新代码必须达标，旧代码的违规记在 `scripts/code-quality-baseline.json`，数字只能变小。

| 指标 | 基线字段 | 新代码上限 | 为什么 |
| --- | --- | --- | --- |
| 文件长度 | `lines` | 代码 400 行，CSS 500 行 | 太长通常说明一个文件做了多件事 |
| 函数长度 | `noExcessiveLinesPerFunction` | 100 行，不算空行 | 一屏看不完的函数很难读懂 |
| 认知复杂度 | `noExcessiveCognitiveComplexity` | 15 | 分支和嵌套越多，越难推理 |
| 嵌套三元 | `noNestedTernary` | 0 | `a ? b : c ? d : e` 改用 `if` 或查表 |
| 类型断言 | `typeAssertions` | 0 | `as` 是让编译器相信你，外部数据要用 Zod 校验。`as const` 不算 |
| 空代码块 | `noEmptyBlockStatements` | 0 | 空的 `catch` 会吞掉错误。确实要忽略时写注释说明原因 |
| CSS 优先级倒序 | `noDescendingSpecificity` | 0 | 后写的规则反而不生效，容易看错 |
| `!important` | `noImportantStyles` | 0 | 它会让后续样式无法覆盖 |

测试文件不受这些限制。`packages/db/src/schema.ts` 不受文件长度限制，表定义会随数据模型增长。

## 报错时怎么处理

| 提示 | 处理 |
| --- | --- |
| `不能新增违规` | 改代码，不要改基线 |
| `已改善` | 运行 `pnpm quality:update`，把收紧后的基线一起提交。这个命令只会降低数字 |
| `没有任何文件引用` | 删除文件，或把它接入使用的地方 |

确实需要例外时，必须先得到项目负责人同意，再手动修改基线或加抑制注释。这些改动会出现在 diff 里。

文件或函数超限时按职责拆分，不要按行数硬切。

## 工具查不了的约定

- 名字要说清是什么：写 `selectedAssetIds`，不写 `data`、`tmp`、`arr`。布尔值用 `is`、`has`、`can` 开头。
- 先处理异常情况并提前返回，减少嵌套。
- 一个函数只做一件事，函数名能说清它做什么。
- 注释写“为什么”，不写“做了什么”。
- 优先用直白的写法，不为少写几行用技巧。
- 外部输入都当作 `unknown`，用 Zod 校验后再用。
- 服务端数据用 TanStack Query，交互状态用 Zustand，能算出来的值不存 state。
