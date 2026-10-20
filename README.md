# LycoBo

[![CI](https://github.com/PixelMerch/lycobo/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/PixelMerch/lycobo/actions/workflows/ci.yml?query=branch%3Adev)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![HeroUI](https://img.shields.io/badge/HeroUI-3-BAA4FF)](https://heroui.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

**面向电商商家团队的 AI 商品图片工作台。**

上传商品参考图、描述画面，后台生成图片，结果自动进入历史记录和素材库。以商品图片生产为起点，逐步整合 TikTok 带货素材、视频制作、批量发布与效果分析。

[快速开始](#快速开始) · [启用真实生图](#启用真实生图) · [技术栈](#技术栈) · [文档](#文档)

## 当前能力

| 模块 | 已实现 |
| --- | --- |
| 图片创作 | 文生图、参考图编辑，五个 GPT 图片模型，新草稿默认 1K |
| 任务执行 | PostgreSQL 任务与 outbox、BullMQ 队列、独立 Worker，记录用户、组织、提示词、参数、时间及实际图片尺寸 |
| 历史记录 | 任务与右侧缩略图联动，提示词展开／复制、恢复编辑、确认后重新生成 |
| 素材管理 | 生成结果自动保存，鉴权缩略图预览、原图下载；收藏保留在当前浏览器会话 |
| 创作体验 | 深色紫色三栏布局、生成状态动画、提交成功清空输入、滚动回顶与窄屏适配 |
| 调用核对 | 内部积分预留／释放，不确定的服务商结果进入待核对，避免盲目重发付费请求 |

企业账号密码支持 JWT 登录、会话恢复和退出，初始化配置见 [企业鉴权](docs/enterprise-auth.md)。微信扫码与短信登录尚未接入。

**后续规划：** 带货视频、爆款复刻、TikTok 定时批量发布与效果数据；团队邀请、在线支付和对象存储。这些能力目前不能作为已上线功能使用。

### 图片模型

| 模型 | 可选分辨率 |
| --- | --- |
| `gpt-image-2.5` | 1K |
| `gpt-image-2.5-flare` | 1K |
| `gpt-image-2.5-sunburst` | 1K |
| `gpt-image-2` | 1K |
| `gpt-image-2-4K` | 1K、2K、4K |

五个模型的 1K 与一次 `gpt-image-2.5` 参考编辑已有真实调用记录；其他模型编辑、高分辨率及非方形输出仍需逐项验收。请求档位与返回图片的实际宽高分别保存，详细能力与边界见 [生图接入](docs/image-generation-api.md)。

## 快速开始

从仓库根目录执行。首次创建 `.env`，保留已有配置：

```sh
test -f .env || cp .env.example .env
```

### Docker Compose

需要 Docker 与 Compose 插件：

```sh
docker compose up -d --build --wait
```

| 服务 | 默认地址 |
| --- | --- |
| Web | <http://localhost:8080/> |
| API 健康检查 | <http://127.0.0.1:8788/api/health/live> |
| PostgreSQL | `127.0.0.1:55432` |
| Redis | `127.0.0.1:56379` |

Compose 启动 Web、API、Worker、PostgreSQL 和 Redis。页面 TSX/CSS 支持热更新，API／Worker 源码修改自动重启；依赖或构建配置变化后重新构建。生图默认关闭，启用步骤见下一节。

```sh
# 查看运行日志
docker compose logs -f web api worker

# 停止服务，保留数据库与图片
docker compose down
```

### 本机开发

固定使用 **Node.js 24.13.0+（24.x）** 和 **pnpm 10.34.7**：

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm dev
```

本机 Web 为 <http://127.0.0.1:5173/>，API 为 <http://127.0.0.1:8787/api/health/live>。`pnpm dev` 同时启动 Web、API 和 Worker；浏览器的 `/api` 通过 Vite 代理到 API，不向前端公开服务商密钥。

本机与 Compose 使用不同的 Web／API 默认端口；如需同时运行，应保持数据库、队列及图片目录配置一致。启动与代理说明见 [本地开发](docs/development.md)。

## 启用真实生图

安装依赖、确认 `.env` 的本地数据库配置，并填写服务端 `VAKV_API_KEY` 后执行：

```sh
pnpm infra:up
pnpm db:migrate
pnpm --filter @lycoboai/api images:setup
pnpm dev
```

`images:setup` 仅供本机开发：创建或复用工作台身份，将应用令牌、图片目录与生图开关写入 `.env`，不输出密钥；本地令牌有效期为 7 天。若使用 Compose，初始化后执行 `docker compose up -d --build --wait` 应用配置。

任务和图片元数据持久化到 PostgreSQL，图片保存到私有 `data/images` 目录，API 与 Worker 共用存储。提示词草稿与收藏仍属于客户端会话状态；正式身份、支付与分布式存储接入见 [API 文档](docs/image-generation-api.md)。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 运行环境 | Node.js 24 · pnpm 10 workspace · TypeScript 5.9 |
| 前端 | React 19 · Vite 8 · React Router 8 |
| 界面 | HeroUI 3 · Tailwind CSS 4 · Tabler Icons |
| 状态管理 | TanStack Query 5（服务端数据）· Zustand 5（客户端交互） |
| API 与校验 | Hono 4 · Zod 4 · Pino |
| 数据与任务 | PostgreSQL 17 · Drizzle ORM · Redis 7.4 · BullMQ 6 |
| 图片处理 | Sharp · 私有本地图片与缩略图存储 |
| 质量检查 | Biome · Vitest · Playwright · commitlint · GitHub Actions |

精确版本以各应用的 `package.json` 和 [pnpm-lock.yaml](pnpm-lock.yaml) 为准。技术选择见 [技术栈与决策](docs/tech-stack.md)。

### 项目结构

```text
apps/
  web/          React 创作工作台
  api/          Hono 鉴权、上传与任务接口
  worker/       独立队列消费者与图片生成
packages/
  contracts/    浏览器安全的共享契约
  db/           PostgreSQL schema、迁移与持久化
  generation/   模型服务商适配
  queue/        队列契约
  storage/      私有图片存储
```

进程与模块边界见 [架构与目录](PROJECT_STRUCTURE.md)。

## 验证与构建

CI 徽章关联 `dev` 分支的实际工作流，包含 Quality（类型、测试与构建）、Browser、Infrastructure 等检查。

| 命令 | 用途 |
| --- | --- |
| `pnpm check` | lint／边界、类型检查、单元测试和生产构建 |
| `pnpm test:e2e` | 浏览器行为与响应式验收 |
| `pnpm test:integration` | 隔离数据库／队列集成检查，需显式本地配置 |
| `pnpm check:release` | 代码检查与浏览器验收 |
| `pnpm build` | 构建 Web、API 和 Worker 等工作区包 |
| `pnpm dev:worker` | 单独启动 Worker |
| `pnpm db:generate` | 生成待审查的数据库迁移 |
| `pnpm db:migrate` | 对指定数据库执行迁移 |

首次运行浏览器测试前安装 Chromium：`pnpm exec playwright install chromium`。集成测试的隔离环境要求见 [测试说明](docs/testing.md)。

## 开发与提交

默认直接在本地 `dev` 开发，`main` 用于稳定版本；仅在明确要求时新建分支。验证完成后提交本地，按需推送并创建或更新 `dev → main` 的 PR。

提交信息使用 Angular 风格英文格式：

```text
feat(web): add floating back-to-top control
fix(worker): preserve successful image outputs
docs(repo): refresh project readme
```

使用 `type(scope): subject`，英文描述以动词原形开头、不加句号。适用范围与审查规则见 [协作规范](CONTRIBUTING.md) 和 [Agent 规则](AGENTS.md)。

## 文档

完整分类见 [文档索引](docs/README.md)。

- [产品范围](PRD.md)：目标用户、导航与首版范围。
- [设计规范](DESIGN.md)：深色紫色工作台、组件状态与响应式。
- [生图接入](docs/image-generation-api.md)：模型能力、鉴权、任务、存储与本地身份。
- [实现与验收](docs/image-studio-implementation.md)：当前工作台交互与边界。
- [本地开发](docs/development.md) · [技术栈](docs/tech-stack.md) · [架构](PROJECT_STRUCTURE.md)。
- [测试](docs/testing.md) · [发布](docs/releasing.md) · [安全](SECURITY.md)。
