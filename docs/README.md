# 项目文档

先阅读根目录 [PRD.md](../PRD.md)、[DESIGN.md](../DESIGN.md) 和 [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)。当前页面UI已于2026-10-22确认定稿，后续维护保持现有外观。这里仅保留持续维护的实施文档，不重复堆积历史修改记录与过期设计稿。

## 产品与设计

按产品范围 → 视觉规范 → 组件选型 → 一致性检查的顺序阅读。视觉数值只在 DESIGN.md 维护，研究资料用于解释决策。

| 主题 | 文档 |
| --- | --- |
| 产品范围、导航与功能边界 | [产品需求](../PRD.md) |
| 唯一视觉与交互规范 | [设计规范](../DESIGN.md) |
| 功能目录与依赖方向 | [项目结构](../PROJECT_STRUCTURE.md) |
| HeroUI 组件选型 | [组件清单](heroui-components.md) |
| UI 复用、审查与交付 | [一致性维护](ui-consistency.md) |
| 当前研究依据与素材来源 | [设计资料](design/README.md) |

## 功能与服务

| 主题 | 文档 |
| --- | --- |
| 工作台状态与素材 | [工作台实现](image-studio-implementation.md) |
| 多区域图片修改与画布 | [局部编辑](local-image-repair.md) |
| JSON 返回结构与业务码 | [API 返回规范](api-response.md) |
| 企业账号密码与 JWT | [企业鉴权](enterprise-auth.md) |
| 生图鉴权、任务、Worker 与存储 | [生图 API](image-generation-api.md) |
| 任务生命周期 | [任务与幂等约束](task-lifecycle.md) |
| 企业共享余额、充值与收支 | [企业钱包](enterprise-wallet.md) |
| 素材与生成任务的数据库命名 | [数据库命名](database-naming.md) |

## 开发与维护

| 主题 | 文档 |
| --- | --- |
| 本地启动与配置 | [本地开发](development.md) |
| 技术选择与边界 | [技术栈](tech-stack.md) |
| 测试与隔离环境 | [测试说明](testing.md) |
| 数据库完整导出与恢复 | [数据库备份](database-backup.md) |
| 发布与分支流程 | [发布说明](releasing.md) |
| 技能及来源 | [项目技能](skills.md) |
| 依赖和素材声明 | [第三方说明](third-party.md) |

维护要求：产品范围写入 PRD，视觉参数写入 DESIGN，实现状态写入对应模块文档；不要新增同一主题的 v2／v3 副本。图片必须被当前文档或应用引用；删除旧资料时同步检查链接，避免索引保留失效入口。
