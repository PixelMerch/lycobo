import { Button, Link, Spinner } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { creditsMessages } from "./credits-messages";

/** 创建收银台或继续本次付款，保留购买按钮的加载与备用链接。 */
export function CheckoutAction({
  url,
  focus,
  label,
  buy,
  pending,
  disabled,
  onBuy,
}: {
  url: string | undefined;
  focus: () => boolean;
  label: string;
  buy: string;
  pending: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const t = useMessages(creditsMessages);
  if (!url)
    return (
      <Button
        variant="primary"
        className="credit-pack-buy"
        aria-label={pending ? t.openingCheckout : label}
        isDisabled={disabled}
        isPending={pending}
        onPress={onBuy}
      >
        {pending && <Spinner size="sm" color="current" aria-hidden="true" />}
        {pending ? t.openingCheckout : buy}
      </Button>
    );
  return (
    <Link
      className="credit-pack-buy"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (focus()) event.preventDefault();
      }}
    >
      {t.openCheckout}
    </Link>
  );
}
