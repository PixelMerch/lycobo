# 视频创作实现边界

当前生产为纯 Cloudflare Workers，本阶段不接入视频。API 不开放视频提交，图片 Worker 不调度视频，主站媒体入口不提供 MP4。本文描述保留的隔离实现和未来接入前需要验证的契约，不能当作线上已支持。

## 保留的契约与代码

- `packages/contracts/src/videos/video-generation.ts`：必填场景描述、可选参考图片、比例、时长及输入校验。
- `apps/api/src/features/videos/`：薄路由、服务和参考素材归属校验；是否挂载由入口组装决定。
- `packages/db/src/videos/video-repository.ts`：固定 PostgreSQL 业务操作。相关表与函数随当前 Drizzle 迁移链保留，不能删除已合并迁移或运行时建表。
- `generation_jobs` 和 `generation_job_items` 保留任务与钱包关联；`generation_video_outbox` 独立保存持久意图、租约、供应商任务 ID 和下一次查询时间。
- `apps/worker/src/videos/video-processor.ts` 与 `packages/generation/src/videos/video-provider.ts`：隔离供应商 fixture、领取与原任务核对。
- `packages/storage`：隔离 Node 环境中的 MP4 容器校验、FFmpeg/ffprobe 和本地 S3 存储；这些二进制不进入当前 Workers 图片运行路径。
- `apps/web/src/features/video/`：保留视频草稿、分镜、封面和按需加载播放器，当前生成能力由服务端明确关闭。

## 未来启用前的约束

任务、扣费与 outbox 必须原子提交，消费者独立于 API 和页面生命周期。未知供应商提交不得自动重投，重复回调或结果核对不能重复扣费。参考图的组织归属、访问签名、大小、媒体类型和有效期都要在服务端校验。

隔离本地带图视频可以使用 `VIDEO_REFERENCE_ORIGIN` 指向本地资源服务的受控 HTTPS 源站；网页预览仍走本机地址。消费者检查供应商是否能无登录读取签名参考图，失败时不得先提交模型。此配置仅供显式本地验证，见 [本地开发](development.md)。

正式接入要重新选择符合 Workers 生命周期的视频处理方式，并验证真实供应商的分组权限、任务核对、失败退款、成品持久化、Range 播放和原图下载。当前 HTTP fixture 只能证明代码契约，不代表真实生成质量、价格或平台兼容性已经验收。

## 验证

本地 `pnpm test:integration` 覆盖持久任务、钱包幂等和隔离供应商 fixture。CI 的 `video-creation.spec.ts` 等浏览器用例只使用 fixture 验证交互，不调用真实模型。
