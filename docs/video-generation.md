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

## 自动成片

上传一张商品图片并填写场景描述后，「立即生成」依次调用 DeepSeek 规划、Image 2.5 出图、DeepSeek 优化成片提示词和现有视频提交。默认准备三张参考画面，视频使用商品原图与按分镜顺序生成成功的画面，请求 9:16、10 秒。右侧显示三步制作进度与视频历史。纯文字和载入历史的已有参考组使用原有视频提交路径。

预计积分分为画面 6 和视频 100。首次启动前检查余额，图片和视频分别按各自任务规则扣退。部分出图成功时使用成功画面，全部未生成时暂停视频提交。同一浏览器会话保留待确认请求及已受理的阶段，页面刷新后可继续，沿用已有任务及其幂等编号。

`GET /api/v1/video-storyboards/capabilities` 检查已配置的 DeepSeek 规划渠道，`POST /api/v1/video-storyboards` 以 `plan` 或 `video` 阶段调用现有的服务端规划通道。两阶段使用独立幂等键和已有计划持久化、限频与归属校验，DeepSeek 只接收文字和图号。图片和视频继续使用各自的现有任务接口，无新增数据库迁移。

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

实施迁移为packages/db/migrations/0039_video_outbox.sql及cloudbase/migrations/20261103120000_video_generation.sql（分别用于Node PG与CloudBase共享PG）；CloudBase素材列表的分辨率与时长另需cloudbase/migrations/20261104100000_video_asset_specs.sql，未执行时素材封面只是不显示这两项。CloudBase迁移除建表／固定视频RPC外，也按断言定位片段扩展既有图片RPC的媒体过滤并排除视频超时处理；不能自动db push或在运行时建表。

部署资源服务、消费者与API之前，先在目标库应用视频任务、素材规格、私有桶和权限迁移。`20261104120000_video_runtime_privileges.sql` 撤销 CloudBase 默认赋予客户端角色的 RPC 与 outbox 权限，服务端角色通过固定 RPC 执行任务。真实收费验收须验证纯文字、参考图、成品播放与下载、扣费和失败退款，并在明确限额下进行。

## 本地验证

pnpm check；pnpm exec playwright test tests/e2e/video-creation.spec.ts tests/e2e/ratio-pager.spec.ts；按docs/testing.md执行隔离的pnpm test:integration。新增verify-videos在一次性本地数据库中验证并发幂等、100积分扣退、未知提交防重、异步原任务下载、成品video入库及图片超时隔离，不访问真实供应商。

CloudBase消费者复用生图私有桶保存视频MP4。发布前应用 `cloudbase/migrations/20261104110000_private_video_storage.sql`，给现有私有桶追加 `video/mp4`，并将桶的单对象上限提高至至少128MiB。应用层视频上传上限128MiB，图片上限32MiB。参考图仍通过已有生图上传接口入库，供应商只收到临时签名，不收到云存储Key。

## 封面与播放

2026-11-03：历史列表只加载从真实视频帧提取的WebP封面，按照实际封面比例等比缩小，高度最多320px，点击后才打开视频详情，结构与图片详情相同：左侧播放器按视频实际比例适配，使用产品自带播放控制，不显示浏览器原生控制条；中间为提示词等信息；右侧为全部视频封面，可切换（视觉规则见DESIGN.md“视频预览”）。右侧历史索引复用图片缩略图，只显示真实封面。参数行无参考图时不显示“纯文字”。素材库视频也复用封面，不把MP4当缩略图加载；分辨率与时长取自生成任务（素材列表的`resolution`、`duration_seconds`，可选字段），不读取视频文件。预览不展示浏览器内置下载菜单。

2026-11-04：预览直接播放原视频，不再生成独立的预览视频。同一条10秒视频的实测：转码预览为356×640、20fps、视频码率约0.2Mbps（350KB），原视频为960×1728、24fps、约5.3Mbps（6.9MB）；预览放大到弹层后明显发糊。代价是每次打开传输原文件大小，详情打开前不请求视频，切换时只请求当前视频。

资源服务使用固定依赖ffmpeg-static@5.3.0，只把原对象`ID.mp4`派生为`ID.mp4.thumbnail.webp`封面，保存在同一私有桶；无需数据库迁移。新旧视频均在首次授权GET请求时补齐封面，HEAD不触发处理。身份和来源校验、签名用途校验均在对象读取及解码之前；封面缺失／解码失败不回退原视频。播放用途`preview`与下载用途`download`使用各自签名，下载保留附件响应。早期已生成的`ID.mp4.preview.mp4`不再被引用。

云函数响应体上限为6MB，原视频不能经资源函数转发。CloudBase `lycobo-assets`完成同样的校验后，把GET播放请求302到不带`download`参数的平台短期URL（最长15分钟，不超过应用签名剩余时间）；本地S3由资源服务按Range读取。平台链接在有效期内由持有者访问，不再次经过来源校验。平台文档没有写明签名GET是否返回206：支持时边下边播、可拖动；不支持时Chrome下载完才开始播放（moov在文件尾），前端读取`seekable`后禁用拖动和快进，Safari可能无法播放。首次部署后必须用桌面Chrome、Safari和iPhone各打开一条真实视频验收播放与拖动。

封面最长适配480×854；处理串行、同对象合并、待处理数量有界，外部进程40秒超时强制结束；源文件上限128MiB、封面上限2MiB。仅允许读取私有MP4本地临时文件，不启用网络输入协议；完成或失败均删除临时目录，不记录内容或解码器原始错误。

本地依赖允许ffmpeg-static安装脚本。CloudBase发布准备脚本为资源函数单独安装Linux x64二进制并随包携带；这属于本地制品准备，仍需单独授权才部署。修改依赖与根锁文件须随PR显式审查。

自动成片的任务输入在原 `input.video` 旁保存可选的 `input.storyboard.description`。原始商品图仍是参考列表的第一张，之后是按顺序提交的分镜图片。该字段只用于历史展示和任务幂等，Worker 领取的供应商输入沿用原结构。上线时先应用 `20261104130000_video_storyboard_history.sql`，再发布 API 和网页；网页通过视频能力接口的 `storyboardHistory` 识别旧 API。已保存的旧任务按当时保留的描述和参考图展示。
