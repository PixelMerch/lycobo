# 企业共享钱包与图片计费

更新：2026-10-21。主账号对应组织，子账号是组织成员；整个组织只有一个金币余额。金额和金币都是整数，金币不等同于人民币。支付渠道与兑换比例尚未接入，不开放浏览器确认充值或签到领币。

## 模型与价格

| 前台模型 | 分辨率 | 实际供应商模型 |
| --- | --- | --- |
| gpt-image-2 | 1K | gpt-image-2 |
| gpt-image-2 | 2K / 4K | gpt-image-2-4K |
| gpt-image-2.5 | 1K / 2K / 4K | gpt-image-2.5-sunburst |
| nano-banana-2.1 | 1K / 2K / 4K | gemini-nano-banana-2.1 |

统一每张 **20 币**，与分辨率、质量无关。以 contracts 的 imageUnitCredits 为唯一价格来源；旧 IMAGE_CREDITS_PER_IMAGE 配置及 repository 旧价格参数保留读取兼容但不再决定扣费。前台提交公开模型；实际 provider_model 在入队事务中存为快照。历史供应商 ID 继续可读；迁移前排队任务没有快照时沿用原 input.model。生成与编辑共用映射，经现有 Vakv 兼容 images 接口提交。真实渠道尤其 Nano Banana 的参数兼容性仍需供应商实测，测试 fixture 不能当成模型可用证明。

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
3. 按 count × 20 扣费，每张图一条 -20 流水，写入 item 和 outbox；事务提交后才允许 Worker 执行。
4. 同用户、同幂等键、同参数重放返回原任务；即使余额已用完也不会再次扣费。参数变更返回冲突。
5. 确定失败每张退回任务保存的 unit_credits（新任务为20，旧任务保持原价）；部分成功只退失败图片。重复完成/退款不会增加余额。
6. 超时、连接中断等未知结果进入 needs_reconciliation，不自动再次调用付费接口；确认失败后走已有管理员核对入口退币。不能把未知结果直接当成失败退款。
7. 历史重新生成是新任务，会按当前20币/张收费；原任务不被改写。

数据库锁按任务→钱包排序；同组织所有成员共享钱包行锁，防止并发超支。充值按钱包→充值订单排序，所有外部网络验证在事务外完成。

## 只读 API

沿用统一 request_id/code/message/data/error 响应体与既有企业会话/API key 鉴权：

- GET /api/v1/wallet：balance、unitCredits（20）。
- GET /api/v1/wallet/entries?limit=20&before=<流水游标>：企业共享收支、操作人、任务/图片关联与余额快照。
- GET /api/v1/wallet/recharges?limit=20&before=<订单UUID>：企业充值订单及到账状态。

本轮所有成员可读取所属企业账务，与现有企业共享任务/素材权限一致。跨企业不可见。后续如需要“主账号看全部、子账号仅看自己的明细”，应新增明确权限策略，不改变共享余额。

前台账户中心替换原占位，展示企业余额、收支和充值记录，可分页。提交成功与 SSE 任务事件批次失效相关 Query 缓存，重新读取真实余额；断线重连同步余额。不伪造充值成功或自动赠送额度。

## 迁移与发布

- 0008 新建四张表，将 organizations.available_credits 原值复制到唯一企业钱包，正余额写一条 migration-opening 流水，不猜测操作人。
- 旧 image_credit_ledger 与 organizations.available_credits 保留历史证据；新业务只使用 organization_wallets，不能把旧值再次作为可消费余额或再次充值。旧流水不伪装成新账本流水，历史审计查旧表。
- 0009 添加 provider_model 快照。
- 发布时应暂停新提交、排空/停旧 Worker，执行迁移，然后同时切换 API 与 Worker，再恢复提交。新旧扣费代码不可混跑，否则会分别操作两个余额。不能回滚到继续写旧余额的程序。
- 本轮已通过隔离数据库迁移验证，并在备份、暂停 API/Worker 后迁移本地开发数据库：原余额保持一致，已有2条待核对任务保持原状态。生产数据库尚未执行；上线前仍需检查目标与备份。schema/迁移/contracts 在 PR 中需要明确审查。

## 验证

隔离 PostgreSQL/Redis + 本地 HTTP fixture 覆盖：跨成员并发支出、固定20币、余额不足回滚、批量提交重放、逐张失败退款、充值金额不符、支付重复回调、渠道流水号复用、余额与流水和对账、不可修改流水、跨组织隔离与分页。生成/编辑单测验证全部公开模型映射。浏览器测试验证三个模型、分辨率、共享余额和明细。未调用付费模型、未接入真实支付。
