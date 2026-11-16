import { useMessages } from "../../../i18n/messages";
import { referenceMessages } from "./reference-messages";
import "./reference.css";

/** 独立呈现用户提供的原版复刻稿，隔离参考页脚本与 Lycobo 业务会话。 */
export function CommerceLanding() {
  const t = useMessages(referenceMessages);
  return (
    <iframe
      className="openart-reference"
      title={t.title}
      src="/openart-reference/index.html"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
    />
  );
}
