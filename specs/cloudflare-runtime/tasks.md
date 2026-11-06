# 迁移任务

更新：2026-11-06。实现与本地验证不等于已部署。

- [x] 增加 Workers fetch/Queue/Cron 入口与固定版本 Wrangler、生成绑定类型。（R1）
- [x] 移除 CloudBase 运行和发布路径，保留历史 SQL 与一次性复制工具。（R1）
- [x] 接入私有 R2 与 Images，保留 PNG、WebP、校验和源文件检查点。（R2）
- [x] 上传改为 202 + 已鉴权回执查询，消费者处理后登记真实素材，前端等待完成。（R2）
- [x] 接入 PostgreSQL outbox → Queue、延迟查询、Cron 补投与固定接管时间隔离。（R3）
- [x] 默认关闭付费执行；不挂载视频和 SSE，保留原查询兜底。（R1、R3）
- [x] 增加单测、本地 workerd fixture 和隔离 PG 不变量测试。（R4）
- [x] 完成最终 pnpm check、Workers dry-run、隔离集成与 git diff --check，提交本地 dev。（R4）
- [ ] 后续单独授权：建立/核对 Queue、Hyperdrive、Secrets、域名，执行候选部署及真实效果验收。（R4）
