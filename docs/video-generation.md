# 视频创作接入

2026-11-03。实现代码接入FluxPort `Minimax-h3-933特价`；当前只在隔离本地PostgreSQL及显式HTTP／对象存储fixture下验证，未调用付费视频接口、未生成真实视频，也未部署生产或应用远端迁移。

## 用户已确认的规格

- 场景描述必填，最多5000字，参考图片可选，最多9张；支持纯文字。
- 图片属于内容参考，没有专用首帧／尾帧参数；原两张草稿图片保留为图片1、图片2。不增加参考视频、音频输入。
- 固定768p，左侧不展示清晰度和模型名，也不提供分辨率切换；不向供应商传resolution、quality等无效字段。
- 画面比例按9:16、16:9、21:9、4:3、3:4、1:1排列；默认9:16。有参考图时供应商可能沿用图片比例，不保证参数强制覆盖画幅。
- 时长滑杆支持5–30秒整数、步长1秒，默认10秒，支持鼠标、触屏和键盘。悬停预览对应秒数，拖动选择后提交实际秒数。
- 每次任务固定100积分，长短相同，提交时扣费；明确失败只退一次，未知结果不自动退费或重新创建。

依据：[用户提供的型号文档](https://uselg.top/docs?model=Minimax-h3-933%E7%89%B9%E4%BB%B7&group_id=105&offer_id=media_a1079a5c4297ca873598c3be33369d4b)，通过ego-browser核查。供应商按秒计费和本站固定积分是两套规则。

## API与持久数据

- GET /api/v1/video-model：登录后读取可用状态、固定分辨率及固定积分。
- POST /api/v1/video-tasks：企业身份／受信任来源保护，Idempotency-Key为UUID，正文为prompt、seconds、aspectRatio及referenceAssetIds，不接受客户端owner／storage key。
- GET /api/v1/video-tasks：按成员读取历史，before游标分页（每页20），服务端先筛选再分页。
- GET /api/v1/video-tasks/:id：读取归属内的单任务及完成后的签名链接。

沿用统一request_id／code／message／data／error封装。钱包账本和任务使用现有generation_jobs／items，视频异步意图及任务ID保存在generation_video_outbox；不写入图片outbox，不让图片超时扫描接管视频。共享media_assets记录video类型、MP4私有对象key和实测尺寸。素材库新客户端显式传includeVideo=true才包含视频，旧客户端默认不接收新的video工具类型，避免滚动发布时旧界面解析／渲染MP4失败。图片流程拒绝把视频素材作为图片参考。

## 消费与异常

创建前持久记录submitting与租约；供应商ID一旦获得就保存，之后仅查询原任务。没有ID的创建超时、进程崩溃或不确定响应进入待核对，不自动重发。paused／pending_confirmation保留原任务继续核对。查询重试有界、任务核对窗口30分钟；仍不明则保留扣费与原请求记录供人工处理。

completed但video_available=false时继续查询原任务。只有下载完成、MP4容器校验及私有保存成功后才完成任务／入库；失败下载重取原内容，不重新生成。内容体积上限128MiB，超过限制进入待核对，不能伪装为成功或明确失败退款。下载只跟随已允许媒体域名的HTTPS重定向，跨域不转发API凭证。新增域名需经来源核实后修改服务端白名单。

资源服务继续保持私有桶。消费者签发独立provider用途、1小时有效的PNG引用能力，供应商无需本站Cookie／Referer即可读取；普通图片及视频预览继续验证浏览器来源及签名。MP4支持字节Range，预览和下载签名相互隔离。素材网格不请求视频原文件，打开播放器才按需加载。

## 配置与启用顺序

API与消费者需要：

- STANDALONE_IMAGE_API_KEY：复用现有生图Key供API及消费者服务端调用，仍需具备视频型号权限，不再单独配置VIDEO_API_KEY。不经聊天或仓库传递。
- VIDEO_API_ORIGIN：默认https://api.uselg.top，可显式选择文档列出的https://api.ai-media.vip；不在运行时猜测域名重发。
- 复用ASSET_PUBLIC_ORIGIN、ASSET_PATH_PREFIX、ASSET_SIGNING_SECRET及私有CloudBase／本地S3配置。CloudBase环境直接使用同一私有桶的1小时临时签名URL作为视频参考图，无需另配公网素材域名；普通预览继续走现有资源服务。本地隔离S3模式的纯文字视频不需要公网资源地址，成品保存至同一本地私有桶；仅使用参考图时需要供应商可访问的HTTPS资源地址。未配置时，含参考图的请求在扣费前拒绝，不影响纯文字视频。
- 生图与视频默认启用，不再读取IMAGE_GENERATION_ENABLED／VIDEO_GENERATION_ENABLED。密钥、身份、数据库与私有存储仍必须配置完整。

实施迁移为packages/db/migrations/0039_video_outbox.sql及cloudbase/migrations/20261103120000_video_generation.sql（分别用于Node PG与CloudBase共享PG）。CloudBase迁移除建表／固定视频RPC外，也按断言定位片段扩展既有图片RPC的媒体过滤并排除视频超时处理；不能自动db push或在运行时建表。

先按授权应用目标库迁移，再部署资源服务、消费者与API代码，安全配置密钥及可达性；最后在明确限额下授权真实收费验收并验证视频。必须测试文字及参考图、受理到成品、播放与下载、扣费和失败退款。代码构建或fixture成功不代表生产可用。当前没有执行上述生产步骤。

## 本地验证

pnpm check；pnpm exec playwright test tests/e2e/video-creation.spec.ts tests/e2e/ratio-pager.spec.ts；按docs/testing.md执行隔离的pnpm test:integration。新增verify-videos在一次性本地数据库中验证并发幂等、100积分扣退、未知提交防重、异步原任务下载、成品video入库及图片超时隔离，不访问真实供应商。

CloudBase消费者复用生图私有桶保存视频MP4，视频上传上限128MiB、图片上限保持32MiB。参考图仍通过已有生图上传接口入库，供应商只收到临时签名，不收到云存储Key。
