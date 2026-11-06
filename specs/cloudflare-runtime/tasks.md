# 迁移任务

更新：2026-11-06。已部署试用版本，付费模型关闭；远端图片转换效果仍待有效账号验收。

- [x] 增加 Workers fetch/Queue/Cron 入口与固定版本 Wrangler、生成绑定类型。（R1）
- [x] 移除 CloudBase 运行和发布路径，保留历史 SQL 与一次性复制工具。（R1）
- [x] 接入私有 R2 与 Images，保留 PNG、WebP、校验和源文件检查点。（R2）
- [x] 上传改为 202 + 已鉴权回执查询，消费者处理后登记真实素材，前端等待完成。（R2）
- [x] 接入 PostgreSQL outbox → Queue、延迟查询、Cron 补投与固定接管时间隔离。（R3）
- [x] 默认关闭付费执行；不挂载视频和 SSE，保留原查询兜底。（R1、R3）
- [x] 增加单测、本地 workerd fixture 和隔离 PG 不变量测试。（R4）
- [x] 完成最终 pnpm check、Workers dry-run、隔离集成与 git diff --check，提交本地 dev。（R4）
- [x] 按本次授权建立/核对 Queue、Hyperdrive、Secrets、域名并部署；验证读库与签名素材访问。（R4）
- [ ] 使用有效海外账号验收登录、线上图片上传转换质量与延迟；真实付费模型调用另需授权。（R4）
