import { IconCoins } from "@tabler/icons-react";
import { UiIcon } from "./ui-icon";

/**
 * Shared decorative credit token; surrounding text supplies the amount.
 * It follows the Tabler icon set so credits read like every other business icon.
 */
export function CreditCoin({
  size = "action",
}: {
  size?: "small" | "default" | "navigation" | "action";
}) {
  return <UiIcon icon={IconCoins} size={size} className="credit-coin" />;
}
