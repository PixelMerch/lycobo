# 纯 Workers 技术设计

更新：2026-11-06。本文描述本次实现；远端发布尚未执行。

## 入口与依赖

保留已有 Worker 名称 `lycobo` 提供 Static Assets 与 fetch；`lycobo-images` 独立提供 queue 和 scheduled，两者独立发布和回滚。HTTP 与队列处理具有独立生命周期，HTTP 不执行付费图片生成。`apps/api/src/cloudflare-app.ts` 组合原 Hono 服务；`apps/worker/src/cloudflare-runtime.ts` 为每次调用创建 Hyperdrive 仓储、R2 适配和 Images 图片存储。

保留 PostgreSQL 事务、表和已合并迁移。新增的任务接管时间过滤是仓储查询参数，不新增表；素材登记按固定 ID 幂等，并核对组织、用户、key 与内容哈希。Node 入口只接受本地数据库，不能用它继续部署 CloudBase。

## 数据流

上传：浏览器既有压缩 → 认证 POST → R2 暂存输入及有期限的意图 → 202 编号 → Queue 读取真实字节 → Images 校验及标准化 → 保存原图与两种 WebP → PG 素材登记 → R2 完成回执 → 客户端查询后取得素材 ID。上传回执仅服务器写入，查询按原上传人和组织校验。Cron 分页恢复消息发送失败，清理过期暂存文件与回执。

生成：PG 任务/扣费/outbox 原子提交 → 发送 ID-only 消息 → PG claim → 供应商提交/只读结果查询 → R2 源文件检查点 → Images 处理 → R2 原图/变体 → PG finish。轮询时间持久化后通过 Queue delay 继续，Cron 修复传输缺口。未决付费提交不重投，存储失败检查点保留并进入原有待确认流程。

媒体：短期签名与来源验证 → 私有 R2/受保护的对象缓存。缺失变体仅向 Queue 投递组织和素材编号，返回可重试错误；消费者重新从 PG 查询该组织素材，不信任客户端给出的 storage key。视频请求关闭。

## 兼容与约束

新增上传 ticket/status 契约是追加能力；原 201 上传响应在隔离 Node 测试中继续有效。前端只改变数据等待逻辑，不改变冻结 UI。Images binding 的 20MB 输入上限、编码质量与透明度、超大输出失败、参考图不再额外 JPEG 优化等边界集中记录在部署文档。

CloudBase 运行模块与发布脚本删除，通用 outbox drain 和供应商引用 helper 去掉平台命名。历史 SQL、旧环境数据与一次性复制工具保留，不能作为当前生产运行路径。

## 验证

单测覆盖异步上传的未完成状态、用户隔离、消息发送失败恢复、存储故障、重复处理、已提交但回执丢失，以及透明 PNG、WebP 尺寸、动画/超限拒绝和源结果保留。隔离 PG 覆盖重复登记、哈希冲突、旧任务领取/超时隔离与新任务防重。独立 fixture Worker 验证 workerd 的 scrypt、Images、本地 R2 和真实本地 Queue 投递。现有计费和供应商协议测试继续运行，禁止用 fixtures 推断线上效果。
