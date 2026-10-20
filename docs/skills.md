# 团队技能

技能安装在 .agents/skills，随仓库共享；不是只装在当前开发者的全局目录。
.agents/skills-lock.json 固定上游 repository/path/commit，避免不同开发者拿到不同规则。
新安装技能会在下一轮会话中被自动发现；本轮已按文件读取相关规则。

| 技能 | 来源 | 使用范围 |
| --- | --- | --- |
| react-best-practices | vercel-labs/agent-skills | React 性能、状态、异步与 bundle |
| security-best-practices | openai/skills | 安全边界与安全敏感代码 |
| supabase-postgres-best-practices | supabase/agent-skills | 普通 PostgreSQL schema、索引、事务与权限 |
| heroui-react | heroui-inc/heroui | HeroUI v3 组件组合、样式与官方文档抓取 |

React 技能包含 Next.js 内容；不因此引入 Next/RSC/SWR。当前是 Vite + TanStack Query。
Postgres 技能的 Supabase 托管特性不自动适用，不安装 Supabase 服务。
Hono 使用官方文档和本项目 AGENTS，不安装来源不明、重复框架指南。
HeroUI 使用已安装版本的官方文档；禁止混用其他 UI 系统。

heroui-react 技能只提供 v3 通用用法与官方文档抓取脚本（请求 heroui.com），
不覆盖 DESIGN.md 的视觉规范；组件 API 以当前锁定的 @heroui/react 版本文档为准，
并与 lock 中的上游 commit 一起审查。

## 更新

技能变更走独立 PR，先查看上游差异、license、权限与网络动作，再更新快照和 lock。
不要在 CI 自动下载 latest 技能。上游快照不做本地格式化；
.gitattributes 仅对技能目录保留原有行尾空格（包含 Markdown 换行语法），应用代码仍做正常空白检查。不要让技能重写用户需求或自动触发外部发布/消息。
安装使用 Codex skill-installer 的 install-skill-from-github.py，指定 --ref 固定 SHA
和 --dest <repo>/.agents/skills。已有目录不自动覆盖，更新前审查并保留历史。
