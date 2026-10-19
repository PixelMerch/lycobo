# lycoboai

面向国内电商运营的商品生图工作台。运营可以连续提交不同商品，后台执行生成，
通过任务中心找回结果，再进入画布编辑、下载。产品交互与视觉以 [DESIGN.md](DESIGN.md) 为准。

## 当前实现状态

这是可运行、可检查的工程基础版本，不是已接通模型的完整产品。

- 已实现：React/HeroUI 应用壳、路由、本地参考图预览、描述草稿、Hono 健康与能力接口、
  请求校验和统一错误、数据库初始迁移、独立诊断 Worker、CI 与团队规范。
- 已准备但未接通：生成服务和对象存储接口、任务/结果/通知/outbox 数据表。
- 未实现：身份认证、真实上传、生图服务、任务业务 API、outbox 派发器、积分/支付、
  SSE 推送、持久画布、完整设计稿页面。生成按钮禁用，提交 API 返回 503，绝不模拟成功。
- 草稿只存在当前浏览器会话内存；图片只在本地预览，刷新后不保证保留。

## Compose 启动（支持实时更新）

```sh
docker compose up --build
```

启动 Web、API、PostgreSQL 和 Redis，日志打印访问地址：Web <http://127.0.0.1:5173/>，
API <http://127.0.0.1:8787/api/health/live>。修改本地页面 TSX/CSS 自动热更新，API 源码修改自动重启。
首次构建后可直接 `docker compose up`；依赖变化时重新加 `--build`。
后台启动使用 `docker compose up -d --build --wait`，日志用 `docker compose logs -f web api` 查看。
请先停止占用同一端口的 `pnpm dev`。细节见 [本地开发](docs/development.md)。

## 本地启动

要求 Node.js 24（至少 24.13.0）、pnpm 10.34.7；Docker 仅在使用本地数据库/队列时需要。

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

已安装其他 pnpm 版本时，也可使用 `npx pnpm@10.34.7 install --frozen-lockfile`。
不要覆盖已有 `.env`。配置只用模板中的本地凭据，不能复制 bonko 或线上配置。

- Web：http://127.0.0.1:5173
- API：http://127.0.0.1:8787/api/health/live
- Web 的 `/api` 通过 Vite 代理到 API；无生产级跨域通配设置。
- 不启动 Docker 也能运行应用壳和单元测试。

可选本地基础设施：

```sh
pnpm infra:up
pnpm db:migrate
WORKER_ENABLED=true pnpm dev:worker
```

Worker 当前仅处理隔离的诊断队列，不会调用生图 API。详见 [本地开发](docs/development.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 同时启动 Web 与 API |
| `pnpm dev:worker` | 单独启动 Worker，默认关闭，需要显式启用 |
| `pnpm check` | 格式/边界、类型、单测、构建 |
| `pnpm test:e2e` | Chromium 浏览器验收 |
| `pnpm check:release` | 全部本地发布检查 |
| `pnpm format` | 统一格式和安全自动修复 |
| `pnpm db:generate` | 生成迁移，必须人工检查 SQL |
| `pnpm db:migrate` | 对 DATABASE_URL 指向的库执行迁移 |
| `pnpm infra:down` | 停止本项目基础设施，不删除数据卷 |

首次浏览器测试：`pnpm exec playwright install chromium`。

## 文档入口

- [技术栈](docs/tech-stack.md)：选择、版本策略、SSR 与国内部署。
- [架构与目录](PROJECT_STRUCTURE.md)：包边界与运行方式。
- [产品范围](PRD.md)：连续提交、持久任务、画布与通知。
- [设计规范](DESIGN.md)：OiiOii 深色工作室方向、tokens、状态与响应式。
- [协作规范](CONTRIBUTING.md)：分支、提交、PR、代码审查与迁移协调。
- [Agent 规则](AGENTS.md)：自动化开发与技能使用边界。
- [异步任务设计](docs/task-lifecycle.md)：幂等、outbox、重试和通知。
- [测试](docs/testing.md)、[发布](docs/releasing.md)、[安全](SECURITY.md)。
- [技能与来源](docs/skills.md)：项目级技能和适用范围。

项目基于 bonko 的工程规范整理，但不复用其 Astro/Cloudflare 部署、品牌、用户数据或密钥。

## 默认工作台

启动 `pnpm dev` 后访问 <http://127.0.0.1:5173/>。
创作首页、任务中心、项目、案例、作品库和画布共用深色设计系统。
当前默认工作台为交互设计阶段：数据仅存在当前页面会话，刷新重置；不会调用生图、上传或计费 API。
示例图支持本地亮度调整和 PNG 下载。旧版工作台代码已删除；`/design` 地址兼容跳转到新版对应页面。真实生成服务尚未接入。
页面截图与来源说明见 [设计索引](docs/design/README.md)。
