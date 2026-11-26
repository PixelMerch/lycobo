<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/lycobo-landing.svg">
    <img src="apps/web/public/brand/lycobo-landing-black.svg" alt="Lycobo" width="240">
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

访问 <http://localhost:8081/>。Compose 提供本地 PostgreSQL、私有 S3 与 Node API／独立消费者／图片服务／Vite。首次运行需显式迁移本地数据库，启动器过滤线上基础设施凭据；真实生图按模型开关启用并消耗供应商额度。图片通过 `http://127.0.0.1:8791` 签名读取。账号、积分和图片需本地准备；详见 [本地开发](docs/development.md)。

**Cloudflare 运行目标**：`dev` 使用 `lycobo` Worker 承接前端、Hono API、私有资源和可休眠 WebSocket，独立 `lycobo-images` Worker 消费图片 Queue 并执行恢复 Cron，Images binding 处理图片。图片生成和提示词优化已开启，视频关闭；配置与验证边界见 [Cloudflare 运行与部署](docs/releasing.md#cloudflare-运行与部署)。

## 开发检查

AI 接手可先执行 `pnpm ai:context` 获取只读 Git 摘要；文档修改执行 `pnpm docs:check`，该检查也已包含在 lint 中。

| 命令                    | 用途                                     |
| ----------------------- | ---------------------------------------- |
| `pnpm check`            | lint、边界、类型、单元测试与生产构建     |
| `pnpm test:integration` | 隔离数据库与队列集成检查，需显式本地配置 |
| `pnpm build`            | 构建各工作区包                           |

浏览器端到端回归仅在 GitHub Actions 手动运行。本地开发检查见 [测试说明](docs/testing.md)。开发使用 `dev`，稳定版本使用 `main`；提交与合并约定见 [协作规范](CONTRIBUTING.md)。

## 项目与文档

React / Vite 前端、Hono API 和独立 Worker 位于 `apps/`；契约、数据库、队列、模型适配与存储位于 `packages/`。前端按功能分目录，详细边界见 [架构与目录](PROJECT_STRUCTURE.md)。

- [协作规则与 Header 进度](AGENTS.md)
- [企业鉴权](docs/enterprise-auth.md) · [企业钱包](docs/enterprise-wallet.md)
- [工程文档索引](docs/README.md) · [安全](SECURITY.md)
