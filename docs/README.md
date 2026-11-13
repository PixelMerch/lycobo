# 项目文档

产品范围见 [PRD](../PRD.md)，视觉与交互以 [DESIGN](../DESIGN.md) 为唯一规范，代码目录与依赖方向见 [PROJECT_STRUCTURE](../PROJECT_STRUCTURE.md)。本目录只保留当前实现说明和维护手册。

## 开发入口

AI 接手先看 [按任务阅读与交接](ai-workflow.md)，需要时使用 [任务模板](templates/ai-task.md) 和 [交接模板](templates/ai-handoff.md)。

| 需要做什么              | 文档                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| 启动本地环境、配置服务  | [本地开发](development.md) · [技术栈](tech-stack.md)                         |
| 选择组件、统一界面      | [HeroUI 组件清单](heroui-components.md) · [UI 一致性](ui-consistency.md)     |
| 代码规则与质量门禁      | [代码质量约束](code-quality.md)                                              |
| 服务端结构与中文注释    | [Node + TypeScript 最佳实践](node-ts-best-practices.md)                      |
| 学习 TypeScript 和 Node | [学习文档](learning-path.md)                                                 |
| 验证改动                | [测试说明](testing.md)                                                       |
| 提交、发布与回滚        | [发布流程](releasing.md) · [Cloudflare 运行与部署](cloudflare-deployment.md) |

## 功能与接口

| 主题                 | 文档                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| 账号与权限           | [企业鉴权](enterprise-auth.md)                                           |
| 账号设置待开发任务   | [账号设置功能任务书](account-settings-tasks.md)                          |
| 积分与会员           | [共享钱包](enterprise-wallet.md) · [会员定价](membership-pricing.md)     |
| 图片生成与供应商配置 | [生图 API](image-generation-api.md) · [模型服务](model-services.md)      |
| 实时消息与版本更新   | [实时推送](realtime.md)                                                  |
| 图片回调             | [图片 Webhook](image-webhooks.md)                                        |
| 视频创作             | [视频接入](video-generation.md)                                          |
| 首页复刻页原型       | [首页复刻页说明与改进建议](home-replica.md)                              |
| 首页内容替换方案     | [LYCOBO 首页内容与素材方案](home-lycobo-content-plan.md)                 |
| 套图计划与链接分析   | [套图计划](product-variation-plan.md)                                    |
| 家纺裂变             | [家纺生成](textile-generation.md) · [视角示例](textile-view-examples.md) |
| 多区域图片修改       | [局部编辑](local-image-repair.md)                                        |
| API 与数据约定       | [返回规范](api-response.md) · [数据库命名](database-naming.md)           |

## 数据与运维

| 主题                       | 文档                             |
| -------------------------- | -------------------------------- |
| 本地数据库导出与恢复       | [数据库备份](database-backup.md) |
| 本地 S3 与生产私有 R2 边界 | [对象存储](s3-storage.md)        |

## 设计素材与来源

- [页面语言路径](localized-routing.md)：中英文前缀、登录返回、业务导航与草稿保留规则。
- [字体维护](fonts.md)：阿里巴巴普惠体3.0的自托管、字符切片、固定来源和再生成方式。

- [设计资料索引](design/README.md)：规范仍在引用的品牌素材；实际样式以 DESIGN 为准。
- [项目技能](skills.md)：开发技能及来源。
- [第三方说明](third-party.md)：依赖与素材声明。

## 维护约定

- 产品范围写入 PRD，视觉参数写入 DESIGN，实现与运维约束写入对应模块文档，避免同一主题出现 v2／v3 副本。
- 实现变化时直接更新对应说明；只保留有排障、恢复或审计价值的历史记录。
- 新增文档同步更新本索引。删除资料时检查文档和代码引用，配套图片一并清理。
- 示例、设计稿和未来契约必须与生产能力区分，不以文档或 UI 文案代替功能验收。
