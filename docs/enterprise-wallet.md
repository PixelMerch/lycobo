# 企业共享钱包与图片计费

更新：2026-10-21。主账号对应组织，子账号是组织成员；整个组织只有一个金币余额。金额和金币都是整数，金币不等同于人民币。支付渠道与兑换比例尚未接入，不开放浏览器确认充值或签到领币。

## 会员与积分页面及后续边界

Header提供积分与会员入口；会员采用全屏HeroUI Modal，包含个人／团队／企业分类、月／季／年付、积分档位与团队席位展示、说明浮层及本站FAQ。前台套餐价格按用户指定的Oii公开定价核对，来源和矩阵见[membership-pricing.md](membership-pricing.md)。积分包为九档数字选择。上述选择仅保存在组件交互状态，不创建订单、支付、会员、成员账户或积分流水；不自动赠送积分，不增加现有功能限制。产品页面使用正常操作文案，内部未接入状态在开发文档中说明，不在页面重复展示。

账单明细继续读取下文三个只读API，使用共享Query缓存；点击展开积分概览时只挂载收支查询并最多显示前三条，复用30秒缓存；打开账单才挂载收支与订单查询，不增加轮询。Header与侧栏共用现有钱包Query，提交与任务事件继续失效同一缓存。余额始终为企业共享积分，读取失败显示“—”，不可据此推导会员等级或虚构个人余额。Header双入口中积分主点击打开独立充值框，悬停显示概览与明细入口；开通会员进入独立 /membership 页面。账单内的充值积分与会员方案按钮分别进入对应界面，会员与充值不再共用账单顶层页签。

后续实现需先确认：会员绑定企业还是个人、对应功能/模型权限、赠送发放时点、续费/过期规则、赠送与购买积分的有效期及扣减顺序、套餐价格与退款政策。建议沿用企业作为结算主体，将会员资格与积分账本分开建模；服务端校验会员资格及钱包余额，客户端只负责展示。支付成功和赠送须由验签回调及幂等事务入账，不接受浏览器直接确认购买成功。本节是后续实施边界，未新增数据库结构、会员API或支付功能。

## 模型与价格

| 前台模型 | 分辨率 | 实际供应商模型 |
| --- | --- | --- |
| gpt-image-2 | 1K | gpt-image-2 |
| gpt-image-2 | 2K / 4K | gpt-image-2-4K |
| gpt-image-2.5 | 1K / 2K / 4K | gpt-image-2.5-sunburst |
| nano-banana-2.1 | 1K / 2K / 4K | gemini-nano-banana-2.1 |

统一每张 **2 币**，与分辨率、质量无关。以 contracts 的 imageUnitCredits 为唯一价格来源；旧 IMAGE_CREDITS_PER_IMAGE 配置及 repository 旧价格参数保留读取兼容但不再决定扣费。前台提交公开模型；实际 provider_model 在入队事务中存为快照。历史供应商 ID 继续可读；迁移前排队任务没有快照时沿用原 input.model。生成与编辑共用映射，经现有 Vakv 兼容 images 接口提交。真实渠道尤其 Nano Banana 的参数兼容性仍需供应商实测，测试 fixture 不能当成模型可用证明。

## 数据结构

### organization_wallets：企业余额

- id：内部 UUID；organization_id 唯一并关联 organizations。
- balance：当前可用金币，integer、非负；created_at、updated_at：带时区时间。
- 主账号与子账号按服务端身份解析出的 organization_id 访问同一钱包。不能传入另一个组织或用户 ID 来选择扣款账户。

### wallet_entries：不可修改的收支明细

- id：内部 bigint 顺序游标，以字符串返回；不是公开用户 ID。
- wallet_id、user_id：企业钱包及发起人；历史迁移期初允许空操作人。
- kind：opening 期初、consume 生成扣费、refund 失败退回、recharge 充值到账、checkin 签到预留。
- amount：有符号整数；balance_after：本次变动后的余额。
- job_id、item_id：每张图对应一条消费流水，退款关联同一张图。
- recharge_id：充值到账来源；event_key：钱包内唯一幂等键。
- created_at：账务时间；API 提供操作人的十位 UID、任务公开 ID。
- 数据库禁止 UPDATE/DELETE。唯一索引阻止重复扣费、退款、充值；触发器验证成员及任务/充值所属组织。余额更新与流水插入必须同事务执行。

### recharge_orders：充值订单

- wallet_id、user_id：企业与操作人；idempotency_key：组织内唯一建单键。
- credits：该订单固定到账金币；amount_minor：人民币分；currency：CNY。
- status：pending / paid / closed；channel、provider_transaction_id：支付来源及渠道流水号，组合唯一。
- paid_at、created_at：支付与创建时间。
- 创建 pending 订单不增加余额。内部 settleRecharge 校验金额、币种、渠道，锁住钱包和订单，再将订单改为 paid、增加余额、插入充值流水；所有步骤一起提交。
- 同一渠道流水号不能支付两个订单；重复回调返回 replayed，不重复入账。未来支付适配器必须先验签并验证商户/订单归属，不能直接使用浏览器提供的“支付成功”。本轮只有内部方法和只读查询接口，没有充值写接口或真实收款。

### wallet_checkins：后续签到预留

- wallet_id、user_id、business_date、rule_version、credits、ledger_id。
- 目前按企业钱包＋业务日期唯一，避免子账号批量签到放大企业奖励；操作人仍被记录。
- 后续明确奖励值、签到时区（建议 Asia/Shanghai）、连续签到规则后，事务插入签到记录、增加共享余额并写 checkin 流水。现在不提供签到 API、不自动发币。

## 提交与失败结算

1. 校验登录、模型参数、参考图和 Idempotency-Key。
2. 同事务创建任务、锁住企业钱包；余额不足时整个事务回滚，不留下待执行任务。
3. 按 count × 2 扣费，每张图一条 -2 流水，写入 item 和 outbox；事务提交后才允许 Worker 执行。
4. 同用户、同幂等键、同参数重放返回原任务；即使余额已用完也不会再次扣费。参数变更返回冲突。
5. 确定失败每张按该尝试实际消费流水退款（旧任务无消费流水时回退到保存的 unit_credits）；部分成功只退失败图片。重复完成/退款不会增加余额。
6. 超时、连接中断等未知结果进入 needs_reconciliation，不自动再次调用付费接口；管理员核对确认失败可单独退币；用户也可通过明确确认的原任务retry入口结束未交付的旧尝试并重试，旧尝试先退款，再为新尝试扣费，保留“供应商结果仍未知、用户主动重试”的审计记录。响应已返回但图片结构/编码无效（PROVIDER_INVALID_IMAGE_RESPONSE）按未交付结算失败并退款；Worker 同时幂等修复历史上这一错误码的待确认记录，不处理其他未知结果。
7. 失败/部分失败任务通过 POST /api/v1/image-tasks/:jobId/retry 在原任务内仅重试失败项，保留任务 UUID、W 开头公开 ID、原参数和成功图片。旧失败项写 superseded_at，账本及 provider 请求证据保持可查；新项使用新的内部 ID、outbox 和供应商幂等键，避免旧失败响应被复用。worker_id 是执行进程身份，不由浏览器指定。成功任务再次生成仍创建新任务。
8. 重试按当前单价每张2币扣费，原尝试仍按实际历史扣费金额退款。原失败项先确保已退款，新扣款与幂等请求记录、结果项和 outbox 同事务提交；余额不足全部回滚。generation_retries 按组织/操作人/Idempotency-Key 唯一，重放不重复扣款，运行中不允许再次发起重试，结果待核对允许用户主动确认后重试，不允许Worker自动重发；旧尝试写入操作人、结束依据和superseded_at，迟到结果不得再次入账或覆盖新结果。

数据库锁按任务→钱包排序；同组织所有成员共享钱包行锁，防止并发超支。充值按钱包→充值订单排序，所有外部网络验证在事务外完成。

## 只读 API

沿用统一 request_id/code/message/data/error 响应体与既有企业会话/API key 鉴权：

- GET /api/v1/wallet：balance、unitCredits（2）。
- GET /api/v1/wallet/entries?limit=20&before=<流水游标>：企业共享收支、操作人、任务/图片关联与余额快照。
- GET /api/v1/wallet/recharges?limit=20&before=<订单UUID>：企业充值订单及到账状态。

本轮所有成员可读取所属企业账务，与现有企业共享任务/素材权限一致。跨企业不可见。后续如需要“主账号看全部、子账号仅看自己的明细”，应新增明确权限策略，不改变共享余额。

前台账户中心替换原占位，展示企业余额、收支和充值记录，可分页。提交成功与 SSE 任务事件批次失效相关 Query 缓存，重新读取真实余额；断线重连同步余额。不伪造充值成功或自动赠送额度。

## 迁移与发布

- 0008 新建四张表，将 organizations.available_credits 原值复制到唯一企业钱包，正余额写一条 migration-opening 流水，不猜测操作人。
- 旧 generation_credit_ledger 与 organizations.available_credits 保留历史证据；新业务只使用 organization_wallets，不能把旧值再次作为可消费余额或再次充值。旧流水不伪装成新账本流水，历史审计查旧表。
- 0009 添加 provider_model 快照。
- 发布时应暂停新提交、排空/停旧 Worker，执行迁移，然后同时切换 API 与 Worker，再恢复提交。新旧扣费代码不可混跑，否则会分别操作两个余额。不能回滚到继续写旧余额的程序。
- 本轮已通过隔离数据库迁移验证，并在备份、暂停 API/Worker 后迁移本地开发数据库：原余额保持一致，已有2条待核对任务保持原状态。生产数据库尚未执行；上线前仍需检查目标与备份。schema/迁移/contracts 在 PR 中需要明确审查。

## 验证

隔离 PostgreSQL/Redis + 本地 HTTP fixture 覆盖：跨成员并发支出、固定20币、余额不足回滚、批量提交重放、逐张失败退款、充值金额不符、支付重复回调、渠道流水号复用、余额与流水和对账、不可修改流水、跨组织隔离与分页。生成/编辑单测验证全部公开模型映射。浏览器测试验证三个模型、分辨率、共享余额和明细。未调用付费模型、未接入真实支付。

## 原任务重试迁移

0010 添加 image_retries 幂等请求表及 image_job_items.superseded_at（0014 后分别为 generation_retries 和 generation_job_items.superseded_at），将任务位置唯一约束改为仅当前项唯一。查询/聚合只包含当前项；保留旧项用于账务审计。先执行追加迁移，再更新 API 和 Worker。测试包含并发重试、成功项保留、跨组织拒绝、重复退款及历史无效响应修复；不调用付费模型。

本地验证：2026-10-22 在备份并暂停 API/Worker 后执行 0010；历史无效响应结算通过统一幂等退款逻辑完成，W174YOWZN 退回20币。服务已恢复，未触发付费重试。其他超时待确认记录不会据此自动退币；用户之后手动确认重试时按上述原尝试退款与新尝试扣费规则处理。

任务相关表已通过 0014 统一为 `generation_*`；原有费用、账务来源和归属规则保持不变。升级需协调停止旧写入进程，见 [数据库命名](database-naming.md#生成任务迁移与发布顺序)。
