# 项目文档

产品范围见 [PRD](../PRD.md)，视觉与交互以 [DESIGN](../DESIGN.md) 为唯一规范，代码目录与依赖方向见 [PROJECT_STRUCTURE](../PROJECT_STRUCTURE.md)。本目录保留当前实现说明、维护手册和必要的迁移校验记录。

## 开发入口

| 需要做什么 | 文档 |
| --- | --- |
| 启动本地环境、配置服务 | [本地开发](development.md) · [技术栈](tech-stack.md) |
| 选择组件、统一界面 | [HeroUI 组件清单](heroui-components.md) · [UI 一致性](ui-consistency.md) |
| 验证改动 | [测试说明](testing.md) |
| 提交、发布与回滚 | [发布流程](releasing.md) · [CloudBase 部署](cloudbase-deployment.md) |

## 功能与接口

| 主题 | 文档 |
| --- | --- |
| 账号与权限 | [企业鉴权](enterprise-auth.md) |
| 积分与会员 | [共享钱包](enterprise-wallet.md) · [会员定价](membership-pricing.md) |
| 图片生成与供应商配置 | [生图 API](image-generation-api.md) · [模型服务](model-services.md) |
| 异步任务与回调 | [任务生命周期](task-lifecycle.md) · [图片 Webhook](image-webhooks.md) |
| 套图计划与链接分析 | [套图计划](product-variation-plan.md) |
| 家纺裂变 | [家纺生成](textile-generation.md) · [视角示例](textile-view-examples.md) |
| 多区域图片修改 | [局部编辑](local-image-repair.md) |
| API 与数据约定 | [返回规范](api-response.md) · [数据库命名](database-naming.md) |

## 数据与运维

| 主题 | 文档 |
| --- | --- |
| 数据库导出与恢复 | [数据库备份](database-backup.md) |
| 云端数据同步到本地 Docker | [本地数据库同步](cloudbase-local-database-sync.md) |
| 本地 S3、COS 与私有存储边界 | [对象存储](s3-storage.md) |
| 原 PostgreSQL 环境与迁移工具 | [Supabase PostgreSQL](supabase-postgres.md) |

以下迁移记录用于核对数据、定位历史问题和维护迁移脚本；日常发布使用上面的部署手册：

- [CloudBase 运行时迁移](cloudbase-runtime-migration.md)
- [CloudBase 数据库迁移与校验](cloudbase-database-migration.md)
- [CloudBase 图片迁移与校验](cloudbase-storage-migration.md)

## 设计依据与来源

- [设计资料索引](design/README.md)：当前保留的设计依据、已确认方案与素材来源；实际样式以 DESIGN 为准。
- [项目技能](skills.md)：开发技能及来源。
- [第三方说明](third-party.md) · [React Bits 许可](licenses/react-bits.md)：依赖与素材声明。

## 维护约定

- 产品范围写入 PRD，视觉参数写入 DESIGN，实现与运维约束写入对应模块文档，避免同一主题出现 v2／v3 副本。
- 实现变化时直接更新对应说明；只保留有排障、恢复或审计价值的历史记录。
- 新增文档同步更新本索引。删除资料时检查文档和代码引用，配套图片一并清理。
- 示例、设计稿和未来契约必须与生产能力区分，不以文档或 UI 文案代替功能验收。
