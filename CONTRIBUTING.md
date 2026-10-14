# 协作与提交规范

## 开始工作

1. 阅读 README、AGENTS、对应设计/架构文档。
2. 使用固定 Node/pnpm，执行 pnpm install --frozen-lockfile。
3. 从 main 创建 feat/<topic>、fix/<topic>、chore/<topic>、docs/<topic>；
   Agent 可使用 codex/<topic>。初始化首次提交是直接 main 的唯一默认例外。
4. 一次 PR 解决一个完整问题。多人并行建议每人一个 worktree/分支，避免共享 checkout 互相覆盖。

采用短分支 → PR → main，不额外维护长期 dev 分支。main 应始终能通过 CI。
不要修改别人的未提交工作、强推共享分支或把无关格式化混进功能 PR。

## Conventional Commits

```text
<type>(<scope>): <简短说明>

可选正文：问题、行为、重要约束。
BREAKING CHANGE: 如有不兼容变更，明确迁移方法。
```

type 使用 feat、fix、docs、refactor、perf、test、build、ci、chore、revert。
scope：web、api、worker、contracts、db、queue、generation、storage、design、
docs、deps、ci、repo、skills。说明可用中文，描述实际结果。

例：
- feat(web): 增加未查看任务筛选
- fix(worker): 避免重复回调重复生成结果
- docs(repo): 说明本地启动与迁移流程

pre-commit 检查暂存文件；commit-msg 校验提交格式。不要靠跳过 hook 达成交付。
GitHub 使用 squash merge 时，PR 标题也必须满足该规范，CI 会检查标题。
不把远程推送/合并/发布视为本地提交的自动延伸。

## 代码与审查

- strict TypeScript；边界用 unknown + schema 校验，避免 any/非空断言掩盖问题。
- React 函数组件与 hooks，hooks 顶层调用，服务端数据用 TanStack Query。
- Hono 使用组合路由；请求处理与 listen 分离。异步 IO 不能阻塞 API。
- 共享行为先改 contracts，再补调用者和失败测试；跨版本发布需要兼容窗口。
- 不带生产密钥、用户素材或外部账户配置进入仓库。
- 功能测试关注所有权、幂等、状态恢复、失败与取消，不只覆盖 happy path。
- UI PR 带桌面/窄屏截图，清楚说明真实功能与 fixture。

## 多人协作的共享文件

修改根依赖/锁文件、contracts、DB schema/migrations、共享 tokens 前，在 PR/任务中声明影响。
同一个数据库迁移序列由一位作者协调；合并前先同步 main，按最新 schema 重新生成尚未合并的迁移。
已经合并的迁移绝不改写。不要手工拼接 lockfile；解决 package.json 后用固定 pnpm 重建并审查差异。
组件约定见 DESIGN.md，不能各自引入不同 UI 库。

## 合并检查

```sh
pnpm check
pnpm test:e2e
git diff --check
```

数据库/队列变更另跑隔离集成检查，详见 docs/testing.md。
至少一位非作者审查；涉及鉴权、计费、迁移和存储权限时需熟悉该领域的审查者。
仓库管理员创建远程仓库后，需要实际启用分支保护；本地文件不能替代远程设置。

## 远程仓库设置清单

- 保护 main，禁止强推/删除，PR 合并，至少 1 个 approval。
- 要求 Quality / Browser / Infrastructure / PR title 检查通过，名称以工作流实际 job 为准。
- 启用 secret scanning / dependency alerts（以托管服务支持为准）。
- 确定 GitHub 团队后再添加真实 CODEOWNERS；本项目不写不存在的 @组织/团队。
- 生产使用独立 environment、密钥和审批，发布 tag 不等于生产部署。
