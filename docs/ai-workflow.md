# 按任务阅读与交接

先核对分支、HEAD、工作区和代码现状。用 `pnpm ai:context` 看 Git 摘要，需完整状态时用 `git status --short --branch`。读取根规则和涉及目录的 AGENTS，再按下表用 `rg` 定位规范章节、实现和测试。跨层影响涉及权限、计费、重试或兼容性时，继续追查调用方和失败路径。

## 按任务读取

| 任务                   | 阅读入口                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 产品范围               | [PRD](../PRD.md) 的定位、状态标记与对应功能。新增入口、模型、计费或外部能力时核对实现与规划边界。                                                                                                                                                                                                     |
| 前端页面、布局或文案   | [Web 规则](../apps/web/AGENTS.md)、[DESIGN](../DESIGN.md) 的定稿边界与对应章节。涉及共享 token、控件或反馈时补读相应规则；浮层补读材质、关闭、焦点和具名例外。新建控件先查 [HeroUI 清单](heroui-components.md) 与 [UI 一致性](ui-consistency.md)。                                                    |
| 登录、账户、鉴权       | 涉及的 Web/API/DB 规则、[企业鉴权](enterprise-auth.md)、[返回规范](api-response.md)。改登录外观读 DESIGN「登录」；[账号设置任务书](account-settings-tasks.md) 含待开发项。                                                                                                                            |
| 提交、计费、重试、回调 | [API](../apps/api/AGENTS.md)、[Worker](../apps/worker/AGENTS.md)、[共享包](../packages/AGENTS.md)、[DB](../packages/db/AGENTS.md) 中涉及的规则。按需读 [生图 API](image-generation-api.md)、[企业钱包](enterprise-wallet.md)、[图片回调](image-webhooks.md) 与 [业务测试索引](business-test-map.md)。 |
| 上传、转换、媒体访问   | [对象存储](s3-storage.md)、[Cloudflare 部署](cloudflare-deployment.md) 的图片处理与绑定、生图 API 上传部分。实现从 `packages/storage/src` 和图片素材仓储查起。                                                                                                                                        |
| 主动推送、站内消息     | 各层 `realtime`、[实时推送](realtime.md) 与 [业务测试索引](business-test-map.md)。UI 读 DESIGN「右侧消息」与「反馈、响应式与维护约束」。                                                                                                                                                              |
| SQL、表、迁移          | [DB 规则](../packages/db/AGENTS.md)、PostgreSQL 技能、[数据库命名](database-naming.md) 和对应业务文档。追查访问者和消费者。                                                                                                                                                                           |
| API、Worker、包与重构  | [架构与目录](../PROJECT_STRUCTURE.md) 中涉及的目录和依赖方向、[服务端分层与中文注释](node-ts-best-practices.md)。                                                                                                                                                                                     |
| 发布、绑定、域名、回滚 | [发布流程](releasing.md)、[Cloudflare 部署](cloudflare-deployment.md)、对应 Wrangler 配置。                                                                                                                                                                                                           |
| 文档维护               | [文档索引](README.md) 与主题唯一来源。核对本地引用和对应实现。                                                                                                                                                                                                                                        |

用 `rg -n '^#{1,4} ' DESIGN.md` 定位标题，再读需要的范围。后端改动若影响界面状态或交互，也要读对应视觉规则。技能只读适用的 SKILL.md 和本次需要的参考。既有规则、接口与业务事实以原处为准。

## 交付与交接

简单任务在消息中写明目标、边界和验收即可。较大任务用 [任务模板](templates/ai-task.md) 拆成可独立验收的结果；接手或中断时用 [交接模板](templates/ai-handoff.md) 记录一份当前状态。记录分支、依据与实现提交、未提交文件、实测验证、未完成项、下一步和用户已授权的外部操作。接手者重新核对 Git 与实现，交接文字不能授予新权限。

按根规则和 [测试说明](testing.md) 选择验证。本地 UI 目测，浏览器 E2E 只走手动 CI。长日志留在本地临时文件，报告结论和必要的脱敏错误，不传凭据、Cookie、提示词、素材、供应商响应、数据库导出或签名 URL。规则与长期决定更新原有文档。
