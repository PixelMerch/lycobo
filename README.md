<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/lycobo-logo-white.svg">
    <img src="docs/assets/lycobo-logo-dark.svg" alt="LycoBo" width="240">
  </picture>
</p>

<p align="center">面向电商商家团队的 AI 商品图片工作台</p>

<p align="center">
  <a href="https://github.com/PixelMerch/lycobo/actions/workflows/ci.yml?query=branch%3Adev"><img src="https://github.com/PixelMerch/lycobo/actions/workflows/ci.yml/badge.svg?branch=dev" alt="CI"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 24"></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&amp;logoColor=white" alt="pnpm 10"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-149ECA?logo=react&amp;logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 5.9"></a>
  <a href="https://heroui.com/"><img src="https://img.shields.io/badge/HeroUI-3-BAA4FF" alt="HeroUI 3"></a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> · <a href="#开发检查">开发检查</a> · <a href="docs/README.md">项目文档</a>
</p>

上传商品参考图、描述画面，生成结果自动进入历史记录和素材库。支持文生图、参考图编辑和多区域局部修改，面向家纺等电商商品图片的日常创作。

## 主要能力

- **图片创作**：模型与输出参数选择、参考图上传、跨页面草稿保留。
- **历史与素材**：任务定位、重新编辑、失败重试、图片预览与下载。
- **局部修改**：画布框选、逐区描述，保存最近提交的编辑并跳转查看修改版。
- **企业账户**：账号登录、组织共享钱包与收支记录。
- **后台任务**：PostgreSQL 持久化、outbox 与独立 Worker 执行。

模型能力和真实调用验收范围见 [生图 API](docs/image-generation-api.md)。微信扫码、短信登录、在线支付、对象存储及视频发布等仍待接入，具体边界见对应文档。

## 快速开始

先在仓库根目录创建配置，保留已有 `.env`：

```sh
test -f .env || cp .env.example .env
```

**本机开发**（Docker Desktop）

```sh
docker compose up --build
# 后续启动只需 docker compose up
```

访问 <http://localhost:8081/>。Compose 启动本地 PostgreSQL 和 Redis，自动应用本地迁移，运行 Vite、Wrangler API 与生图消费者，支持源码热更新。R2、Images 在本地模拟，任务通过 Redis Streams 投递；数据库、图片与 Redis 分别保存在 Docker 卷。开发入口不连接线上 Supabase、R2 或 Queues；真实生图按 `.env` 中的模型开关和 Key 显式启用，调用会消耗供应商额度。图片通过本地资源域名 `http://cdn.lycobo.localhost:8791` 提供：页面使用 WebP 缩略图／预览，下载才读取原始 PNG。账号、积分及图片需要在本地单独准备。宿主机调试、日志与存储位置见 [本地开发](docs/development.md)。

**CloudBase 自动发布**：main 的 CI 通过后发布前端至 CloudBase 静态应用，使用 GitHub `cloudbase-production` Environment。Cloudflare 发布配置已删除，主站私有图片改用 CloudBase PG 云存储。凭据、后端迁移边界和实际状态见 [CloudBase 部署](docs/cloudbase-deployment.md)，数据副本见 [数据库迁移](docs/cloudbase-database-migration.md)。

## 开发检查

| 命令 | 用途 |
| --- | --- |
| `pnpm check` | lint、边界、类型、单元测试与生产构建 |
| `pnpm test:e2e` | 完整浏览器回归 |
| `pnpm test:integration` | 隔离数据库与队列集成检查，需显式本地配置 |
| `pnpm build` | 构建各工作区包 |

首次运行浏览器测试需执行 `pnpm exec playwright install chromium`。完整流程见 [测试说明](docs/testing.md)。开发使用 `dev`，稳定版本使用 `main`；提交与合并约定见 [协作规范](CONTRIBUTING.md)。

## 项目与文档

React / Vite 前端、Hono API 和独立 Worker 位于 `apps/`；契约、数据库、队列、模型适配与存储位于 `packages/`。前端按功能分目录，详细边界见 [架构与目录](PROJECT_STRUCTURE.md)。

- [产品范围](PRD.md) · [设计规范](DESIGN.md) · [技术栈](docs/tech-stack.md)
- [企业鉴权](docs/enterprise-auth.md) · [企业钱包](docs/enterprise-wallet.md)
- [局部修改](docs/local-image-repair.md) · [数据库备份](docs/database-backup.md) · [Supabase 接入](docs/supabase-postgres.md) · [CloudBase 部署](docs/cloudbase-deployment.md)
- [发布说明](docs/releasing.md) · [安全](SECURITY.md) · [完整文档索引](docs/README.md)
