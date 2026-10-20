# 项目文档

先阅读根目录 [PRD.md](../PRD.md)、[DESIGN.md](../DESIGN.md) 和 [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)。这里仅保留持续维护的实施文档，不重复堆积历史修改记录与过期设计稿。

| 主题 | 文档 |
| --- | --- |
| 本地启动与配置 | [本地开发](development.md) |
| 技术选择与边界 | [技术栈](tech-stack.md) |
| 工作台状态与素材 | [工作台实现](image-studio-implementation.md) |
| 生图鉴权、任务、Worker 与存储 | [生图 API](image-generation-api.md) |
| 任务生命周期 | [任务与幂等约束](task-lifecycle.md) |
| 测试与隔离环境 | [测试说明](testing.md) |
| 发布与分支流程 | [发布说明](releasing.md) |
| HeroUI 组件选型 | [组件清单](heroui-components.md) |
| UI 维护与自动检查 | [一致性维护](ui-consistency.md) |
| 当前参考与素材来源 | [设计资料](design/README.md) |
| 技能及来源 | [项目技能](skills.md) |
| 依赖和素材声明 | [第三方说明](third-party.md) |

维护要求：产品范围写入 PRD，视觉参数写入 DESIGN，实现状态写入对应模块文档；不要新增同一主题的 v2／v3 副本。图片必须被当前文档或应用引用；删除旧资料时同步检查链接，避免索引保留失效入口。
