import { Button, Chip } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import {
  IconArrowUpRight,
  IconChevronRight,
  IconCrown,
  IconInfoCircle,
  IconPlus,
} from "@tabler/icons-react";
import { CreditCoin } from "../../components/credit-coin";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { AssetImage } from "../generation/asset-image";
import { useImageAssets } from "../generation/generation-client";
import type { AccountCenterTab } from "./account-center-tabs";
import { EntryMark } from "./account-entry";
import {
  entryDetail,
  entryNames,
  formatCredits,
  imagesFor,
  recordTime,
  signedCredits,
} from "./account-format";
import { useAccountOverlays } from "./account-overlays";
import { useWallet, useWalletEntries } from "./wallet-client";

export const pressedElement = (target: EventTarget) =>
  target instanceof HTMLElement ? target : null;

type ShowTab = (tab: AccountCenterTab) => void;

export function WalletSummary({ onShowTab }: { onShowTab: ShowTab }) {
  const wallet = useWallet();
  const open = useAccountOverlays((state) => state.open);
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  return (
    <section className="account-card account-wallet-card" aria-labelledby="account-wallet-heading">
      <div className="account-card-head">
        <h2 id="account-wallet-heading" className="account-card-label">
          <CreditCoin size="default" />
          企业共享积分
        </h2>
        <span className="account-card-hint">
          <UiIcon icon={IconInfoCircle} size="small" />
          全企业成员共用
        </span>
      </div>
      <strong className="account-balance">
        {balance === undefined ? "—" : formatCredits(balance)}
      </strong>
      <p className="account-facts">
        <span>
          <b>{unit}</b> 积分 / 张
        </span>
        {balance !== undefined && (
          <span>
            约可生成 <b>{formatCredits(imagesFor(balance, unit))}</b> 张
          </span>
        )}
        <span>生成失败按张退回</span>
      </p>
      <div className="account-card-actions">
        <Button
          variant="primary"
          className="account-primary-action"
          onPress={(event) => open("recharge", pressedElement(event.target))}
        >
          <UiIcon icon={IconPlus} />
          充值积分
        </Button>
        <Button variant="secondary" onPress={() => onShowTab("credits")}>
          积分明细
        </Button>
      </div>
    </section>
  );
}

export function MembershipSummary() {
  const open = useAccountOverlays((state) => state.open);
  return (
    <section className="account-card account-member-card" aria-labelledby="account-member-heading">
      <div className="account-card-head">
        <h2 id="account-member-heading" className="account-card-label">
          <UiIcon icon={IconCrown} className="account-crown" />
          会员
        </h2>
        <Chip size="sm" className="account-chip">
          方案待公布
        </Chip>
      </div>
      <strong className="account-member-state">暂未开通</strong>
      <p className="account-member-copy">
        开通会员后每月获得积分并解锁专属能力；单独购买积分不改变会员等级。
      </p>
      <div className="account-card-actions">
        <Button
          variant="secondary"
          onPress={(event) => open("membership", pressedElement(event.target))}
        >
          查看会员方案
          <UiIcon icon={IconArrowUpRight} />
        </Button>
      </div>
    </section>
  );
}

function RecentEntries({ onShowTab }: { onShowTab: ShowTab }) {
  const entries = useWalletEntries();
  const recent = entries.data?.pages[0]?.data.slice(0, 4) ?? [];
  return (
    <section className="account-card account-recent" aria-labelledby="account-recent-heading">
      <div className="account-card-head">
        <h2 id="account-recent-heading" className="account-card-title">
          最近积分记录
        </h2>
        <Button
          size="sm"
          variant="ghost"
          className="account-more"
          onPress={() => onShowTab("credits")}
        >
          全部明细
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
      {recent.length > 0 ? (
        <ul className="account-entry-list">
          {recent.map((entry) => (
            <li key={entry.id}>
              <EntryMark kind={entry.kind} />
              <div>
                <strong>{entryNames[entry.kind]}</strong>
                <small>
                  {recordTime(entry.created_at)} · {entryDetail(entry)}
                </small>
              </div>
              <b className={entry.amount > 0 ? "account-amount is-positive" : "account-amount"}>
                {signedCredits(entry.amount)}
              </b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-empty" role="status">
          {entries.isPending
            ? "正在加载记录…"
            : entries.isError
              ? "记录暂时不可用"
              : "暂无积分记录"}
        </p>
      )}
    </section>
  );
}

/** Works live in the asset library; following a link there closes the center first. */
function RecentWorks({ onLeave }: { onLeave: () => void }) {
  const assets = useImageAssets({ kind: "output", type: "image" });
  const works = assets.data?.pages[0]?.data.slice(0, 6) ?? [];
  return (
    <section className="account-card account-works" aria-labelledby="account-works-heading">
      <div className="account-card-head">
        <h2 id="account-works-heading" className="account-card-title">
          个人作品
        </h2>
        <RouteLink to="/assets" className="account-more" onClick={onLeave}>
          进入素材库
          <UiIcon icon={IconChevronRight} size="small" />
        </RouteLink>
      </div>
      {works.length > 0 ? (
        <ul className="account-works-grid">
          {works.map((asset) => (
            <li key={asset.id}>
              <AssetImage
                assetId={asset.id}
                thumbnail
                alt={asset.prompt ?? "生成图片"}
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-empty" role="status">
          {assets.isPending ? (
            "正在加载作品…"
          ) : assets.isError ? (
            "作品暂时不可用"
          ) : (
            <>
              暂无作品，
              <RouteLink to="/workspace" className="account-inline-link" onClick={onLeave}>
                去工作区创作
              </RouteLink>
            </>
          )}
        </p>
      )}
    </section>
  );
}

export function AccountOverview({
  onShowTab,
  onLeave,
}: {
  onShowTab: ShowTab;
  onLeave: () => void;
}) {
  const wallet = useWallet();
  const entries = useWalletEntries();
  useErrorToast((wallet.error ?? entries.error)?.message);
  return (
    <div className="account-overview">
      <WalletSummary onShowTab={onShowTab} />
      <MembershipSummary />
      <RecentEntries onShowTab={onShowTab} />
      <RecentWorks onLeave={onLeave} />
    </div>
  );
}
