# 企业共享钱包与图片计费

本地账本按工作区计费，企业主账号和子账号共用所在组织的积分余额。启用 Creem 后，图片生成优先从工作区站内积分余额全额扣除。站内积分不足时，才尝试全额使用当前登录用户的 Creem 购买积分。站内组织权限继续控制订单和任务可见范围。积分和订单金额按最小单位存储为整数。

## 充值积分与账单

登录后的「特惠充值」、积分菜单和账户设置共用全屏充值弹框。生图请求收到服务端的积分不足响应时也打开该弹框，并保留原草稿。关闭时焦点回到仍可用的入口，用户可手动再次提交。

充值弹框展示五档一次性积分包，定价在 `apps/web/src/features/account/credits/credit-pack-pricing.ts` 维护。活动价按每张 2 积分和 1 美元约 ¥6.80 计算，基础积分折约 ¥0.40/张。档位越高，赠送比例越大，含赠送积分的单张估价从 ¥0.39 依次降至 ¥0.35。常规价按活动价的 1.5 倍四舍五入到美分。提交生成前会展示实际积分消耗。

| 基础积分 |  常规价 | 活动价 | 赠送积分 | 活动期间预计出图 | 活动单张估价 |
| -------: | ------: | -----: | -------: | ---------------: | -----------: |
|      102 |   $4.49 |  $2.99 |        2 |            52 张 |        ¥0.39 |
|      680 |  $29.99 | $19.99 |       40 |           360 张 |        ¥0.38 |
|    1,360 |  $59.99 | $39.99 |      110 |           735 张 |        ¥0.37 |
|    2,040 |  $89.99 | $59.99 |      230 |         1,135 张 |        ¥0.36 |
|    3,400 | $149.99 | $99.99 |      480 |         1,940 张 |        ¥0.35 |

服务端可用 `BILLING_OFFER_END_AT` 配置 UTC ISO 8601 活动结束时间，默认截止于北京时间 2026 年 12 月 7 日 00:00。活动结束后，站内显示常规价格和基础积分，只允许创建已配置的常规价订单。Creem 后台保存的活动收银台和商品同步按运营规则处理。

购买按钮要求登录，只显示服务端已配置的档位。客户端提交套餐编号与请求幂等键，由服务端校验活动时段、价格、积分交付和买家归属后创建托管收银台。已有人民币订单保留在账单中，线上订单使用美元美分记录。

顶栏、积分明细和账户设置显示站内积分与购买积分的合计。任一余额未知时显示“—”。两处明细共用按时间分页的流水，保留收支筛选与充值订单。买家看到同笔充值的合计到账额，其他工作区成员只看到共享的赠送积分。当前余额统一显示在明细上方。

### Creem 申请准备

站点公开三份政策和统一客服邮箱 `support@lycobo.com`，当前价格与档位由充值弹框和结账显示。用户协议第 5 节为可接受使用政策。申请时，Creem 商家资料和收据使用同一客服邮箱。发布正式政策前确认运营主体法定信息、生效日期与隐私披露。退款页面中的 Creem 条款适用于通过 Creem 成交的订单。 [Creem 商家审核指南](https://docs.creem.io/merchant-of-record/account-reviews/account-reviews)

Creem 正式目录按充值页配置五档一次性积分包。活动价和常规价使用不同商品，活动结束后按服务端目录切换。活动入门包 $2.99 USD，Creem 到账 102 积分，Lycobo 站内赠送 2 积分。正式交易由 Creem 的商户审核状态控制。 [Creem 生成式 AI 接入指南](https://docs.creem.io/merchant-of-record/account-reviews/gen-ai-technical-integration-guide)

### 支付渠道与积分扣费

- Lycobo 维护套餐、用户与工作区归属、站内订单、任务和计费记录。支付渠道负责创建收银台、确认付款和处理订单退款，生成流程通过统一的积分钱包服务查询余额、扣费和退回积分。
- 后台手动发放、站内奖励及未来签到积分记入 Lycobo 本地账本。通过 Lycobo 购买的基础积分由 Creem 发放，活动赠送积分在已验签且匹配站内订单的支付回调中发到原工作区站内钱包。账户界面汇总两边的积分和流水，订单显示总到账积分。
- Creem 的商品、客户、钱包和交易编号存放在服务端渠道记录中，用站内订单和任务 ID 关联。Creem 售出的积分以 Creem 钱包为准，站内记录用于展示和对账，到账通知只触发刷新。同一个生成请求只从为它选定的钱包扣费，失败冲正沿用原交易及钱包。
- 更换渠道时，新订单可走新的支付适配器。已有订单的退款继续按原渠道处理。Creem 钱包未消费的余额需逐账户对账后，按双方确认的方案继续履约或迁移，同一份余额只能由一个钱包接受消费。开启 Creem 审核时，两个钱包支持的图片生成路径都在模型调用前审核，Creem 钱包扣费还须保存逐图审批 ID。 [Creem 生成式 AI 要求](https://docs.creem.io/merchant-of-record/account-reviews/gen-ai-requirements)

### Creem 验证与切换

1. 在隔离库应用 `0050_billing_adapters` 和 `0051_billing_local_bonus`。测试环境创建独立商品并配置审核型 AI generation credits 交付。API 与图片 Consumer 使用同一环境的 `CREEM_API_KEY`，本地开发只传递 `creem_test_` 测试密钥。
2. API 配置 `BILLING_PROVIDER=creem`、`CREEM_MODERATION_ENABLED=true`、`CREEM_WEBHOOK_SECRET`，并通过 `BILLING_PRODUCTS` 映射可售商品，例如 `{"offer:trial":"prod_…"}`。Creem webhook 指向 `/api/v1/webhooks/creem`，订阅 `checkout.completed` 和 `credits.granted`。正式目录与测试目录独立。
3. 买家需有登录身份关联的邮箱。Creem 自动发放套餐基础积分。验签回调匹配站内订单、预期金额、商品和买家，在同一事务中标记已付款并记录站内赠送流水，回调重放不重复赠送。提示词优化仍使用既有本地计费。
4. 模型、参考图和余额预查并行。选定扣费钱包后审核图片生成提示词，审核通过后才持久化生成任务。使用 Creem 购买积分时，为每张图片保存独立审批和扣费意图，扣费成功后才投递任务。明确失败按原交易冲正，结果未知则保留原操作并用幂等键或交易 ID 对账。
5. 切换新购买渠道前先核对 Creem 未消费余额。旧订单和充值记录保留，已接收的 Creem 扣费与冲正按原渠道继续，需保留原密钥和后台结算。已有站内积分继续在原账本履约。

## 模型与价格

线上独立模式的映射来自 `packages/generation/src/images/standalone-models.ts`：

| 展示名称   | 模型 ID                    | 实际供应商模型                 |
| ---------- | -------------------------- | ------------------------------ |
| Image 2    | gpt-image-2                | gpt-image-2                    |
| Image 2.5  | gpt-image-2.5              | gpt-image-2.5-sunburst         |
| Banana 2.1 | nano-banana-2.1            | gemini-3.1-flash-image-preview |
| Banana Pro | gemini-3-pro-image-preview | gemini-3-pro-image-preview     |

统一每张 **2 积分**，与分辨率、质量无关。以 contracts 的 imageUnitCredits 为唯一价格来源；旧 IMAGE_CREDITS_PER_IMAGE 配置及 repository 旧价格参数保留读取兼容但不再决定扣费。前台提交公开模型；实际 provider_model 在入队事务中存为快照。历史供应商 ID 继续可读；迁移前排队任务没有快照时沿用原 input.model。生成与编辑共用映射，经现有 Vakv 兼容 images 接口提交。真实渠道尤其 Nano Banana 的参数兼容性仍需供应商实测，测试 fixture 不能当成模型可用证明。

## 数据结构

### organization_wallets：企业余额

- id：内部 UUID；organization_id 唯一并关联 organizations。
- balance：当前可用积分，integer、非负；created_at、updated_at：带时区时间。
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
- credits：该订单固定到账积分；amount_minor：人民币分；currency：CNY。
- status：pending / paid / closed；channel、provider_transaction_id：支付来源及渠道流水号，组合唯一。
- paid_at、created_at：支付与创建时间。
- 创建 pending 订单不增加余额。内部 settleRecharge 校验金额、币种、渠道，锁住钱包和订单，再将订单改为 paid、增加余额、插入充值流水；所有步骤一起提交。
- 同一渠道流水号不能支付两个订单；重复回调返回 replayed，不重复入账。未来支付适配器必须先验签并验证商户/订单归属，不能直接使用浏览器提供的“支付成功”。这张表保留本地充值方法及历史。Creem 使用独立订单表，到账由 Creem 完成。

### wallet_checkins：后续签到预留

- wallet_id、user_id、business_date、rule_version、credits、ledger_id。
- 目前按企业钱包＋业务日期唯一，避免子账号批量签到放大企业奖励；操作人仍被记录。
- 后续明确奖励值、签到时区（建议 Asia/Shanghai）、连续签到规则后，事务插入签到记录、增加共享余额并写 checkin 流水。现在不提供签到 API、不自动发币。

## 本地账本提交与失败结算

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
- GET /api/v1/wallet/history?limit=20&before=<游标>：合并当前工作区的站内流水及当前用户在该工作区的购买流水。使用 `view=spent` 或 `view=earned` 查看近半年对应记录。
- GET /api/v1/wallet/recharges?limit=20&before=<订单UUID>：企业充值订单及到账状态。

所有成员可读取所属企业账务，与现有企业共享任务/素材权限一致。跨企业不可见。后续如需要“主账号看全部、子账号仅看自己的明细”，应新增明确权限策略，不改变共享余额。

账户中心展示当前工作区的积分余额、收支和充值记录，支持分页。真实账本事件通过实时连接更新余额；断线时按需读取，见[实时推送](realtime.md)。

## 迁移与发布

- 0008 新建四张表，将 organizations.available_credits 原值复制到唯一企业钱包，正余额写一条 migration-opening 流水，不猜测操作人。
- 旧 generation_credit_ledger 与 organizations.available_credits 保留历史证据；新业务只使用 organization_wallets，不能把旧值再次作为可消费余额或再次充值。旧流水不伪装成新账本流水，历史审计查旧表。
- 0009 添加 provider_model 快照。
- 发布时应暂停新提交、排空/停旧 Worker，执行迁移，然后同时切换 API 与 Worker，再恢复提交。新旧扣费代码不可混跑，否则会分别操作两个余额。不能回滚到继续写旧余额的程序。

## 验证

隔离 PostgreSQL + 本地 HTTP fixture 覆盖：跨成员并发支出、固定单价、余额不足回滚、批量提交重放、逐张失败退款、充值金额不符、支付重复回调、渠道流水号复用、余额与流水和对账、不可修改流水、跨组织隔离与分页。生成/编辑单测验证全部公开模型映射。浏览器测试验证三个模型、分辨率、共享余额和明细。未调用付费模型、未接入真实支付。

## 原任务重试迁移

0010 添加 image_retries 幂等请求表及 image_job_items.superseded_at（0014 后分别为 generation_retries 和 generation_job_items.superseded_at），将任务位置唯一约束改为仅当前项唯一。查询/聚合只包含当前项；保留旧项用于账务审计。先执行追加迁移，再更新 API 和 Worker。测试包含并发重试、成功项保留、跨组织拒绝、重复退款及历史无效响应修复；不调用付费模型。
