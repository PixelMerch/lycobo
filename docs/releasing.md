# 发布与部署

本地提交、远程推送、PR 合并、版本发布、生产部署是不同动作。
初始化只建立本地仓库和 CI 文件，不自动创建远程仓库或上线。

## 合并

日常开发直接在本地 dev 进行，先 fetch 并在可快进时同步 origin/dev，保留本地工作；只有用户要求时才创建短分支。完成验证后默认只做本地提交。
用户明确要求推送、PR 或合并后再执行；临时功能分支向 dev 提 PR，发布集成由 dev 向 main 提 PR，填写模板，运行 pnpm check:release。
main 为稳定分支，只有用户明确要求发布集成时才由 dev 向 main 提 PR，不自动部署。
契约/数据库/计费变更安排领域审查；合并前同步目标分支，不覆盖其他作者的迁移。
PR 标题采用 Conventional Commits，合并前必须等 CI 通过并满足目标分支保护。
本次整合使用 merge commit 保留各本地分支的提交祖先关系；后续普通功能 PR 可使用 squash。
dev 合并到 main 后，本地和远程都必须保留 main、dev，不使用 --delete-branch 删除 dev。同步对应本地分支后回到 dev 继续开发。
分支清理始终排除 main、dev；用户要求清理时，只有确认已合入或已被替代的临时分支才可删除，不删除未核实合入的独立工作。

Dependabot 的 npm 与 GitHub Actions 常规版本升级统一向 dev 提 PR，保留原有周期与分组。目标为 dev 的依赖 PR 做冒烟验证，推送 dev 后及发布集成的 dev → main PR 做远程全量浏览器回归，具体规则见 [测试说明](testing.md)。
Dependabot 从默认分支读取 `.github/dependabot.yml`，因此该配置推送到 dev 后，要在下一次获授权的 main 集成完成后才会正式生效。GitHub 的安全更新仍面向默认分支，不受 `target-branch` 控制；此类 PR 继续执行 main 的完整验证。

## 版本与构建

采用 SemVer。破坏契约/数据兼容性需要迁移方案；不能仅增加版本号。
版本由根 package.json 标记，应用的 private workspace 版本不代表独立对外 SDK。
发布使用固定 Node/pnpm 和 frozen lockfile，关联提交 SHA、构建产物和迁移。
已发布 tag 不移动、不覆盖；发布说明说明用户行为、修复、迁移和已知限制。

## 部署顺序

1. 先备份并验证恢复，评估 expand/contract 数据迁移。
2. 部署兼容新旧客户端的 API/Worker，执行经审查的迁移。
3. 发布前端静态产物，验证健康、真实读写和错误率。
4. 稳定后才清理旧字段/契约。

API/Worker 由进程管理器或容器接管，SIGTERM 留足关闭时间。
同域 /api 使用反向代理；SSE 配置不缓冲与合理超时。
数据库池、Worker 并发和模型服务限额一起计算。
国内对象存储/CDN、鉴权、备份、生产密钥尚未配置，本版本不能直接作为生产产品。

## 回滚

代码回滚使用已验证产物；数据库迁移不能默认反向执行。
计费/上传/模型请求等外部副作用需要业务对账，不随代码回滚自动消失。
发布记录保留实际执行人、版本、目标环境、验证与回滚点。


## GitHub Release 与自动日志

`.github/workflows/release.yml` 提供两个显式发布入口：

- 在 GitHub Actions 的 **Release → Run workflow** 选择 `main`，填写 `vX.Y.Z`。
- 将 `main` 上已通过 CI 的提交标记为 `vX.Y.Z` 并推送该 tag。

普通分支推送和 PR 合并不会自动发布。版本号必须与根 `package.json` 一致，
只接受正式 SemVer 标签（如 `v0.1.0`）；工作流验证目标提交属于 `main`，
并要求该提交的 main/push CI 已成功。合并后应先等待 main CI，再触发 Release。
工作流只发布 GitHub Release，不部署网站、执行业务迁移或调用模型。

自动说明由 `scripts/release-notes.mjs` 从真实 Git 历史生成：

- 按功能、修复、性能、重构、文档、自动化和测试分类，列出提交标题及链接。
- 记录作者、与作者不同的提交人和 GitHub 用户链接，不公开作者邮箱。
- 显示每个提交涉及的文件及版本比较链接；首次发布包含完整仓库历史。
- 后续版本以上一个当前提交可达的正式版本 tag 为基线；未合入分支上的 tag 不参与比较。
- Release 正文最多列最近150个提交，过长时进一步缩短；附件 `CHANGELOG.md` 和
  `changes.json` 保存完整日志和全部逐提交文件列表，避免正文长度上限导致记录丢失。

工作流使用固定 SHA 的官方 Actions，只有发布 job 获得 `contents: write` 和 `actions: read`；
无需另建 PAT，不执行来自 PR 的发布逻辑，不把输入拼进 shell 程序。已发布版本不覆盖，
重复触发同一版本会失败；若创建成功但附件上传失败，先核对现有 Release 再修复缺失附件，
不要删除或移动已发布 tag。工作流运行页保留执行人、目标提交和日志。

本地可在不访问 GitHub、不创建 tag／Release 的情况下预览（输出不要提交）：

```sh
node scripts/release-notes.mjs --version v0.1.0 --offline --output /tmp/lycobo-release-preview
```

离线预览使用 Git 中的作者／提交人姓名；正式工作流通过 GitHub API 补齐账号归属。
测试覆盖首版完整历史、后续版本范围、未合入 tag、合并文件变更、作者归属、Markdown转义和API失败。
