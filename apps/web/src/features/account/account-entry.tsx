import {
  IconArrowBackUp,
  IconCalendarCheck,
  IconCirclePlus,
  IconFlag,
  IconPhoto,
} from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import type { WalletEntry } from "./account-format";
import "./account-common.css";

const marks = {
  consume: IconPhoto,
  refund: IconArrowBackUp,
  recharge: IconCirclePlus,
  opening: IconFlag,
  checkin: IconCalendarCheck,
};

/** Decorative kind mark; the entry name next to it carries the meaning. */
export function EntryMark({ kind }: { kind: WalletEntry["kind"] }) {
  return (
    <span className="account-entry-mark" data-kind={kind} aria-hidden="true">
      <UiIcon icon={marks[kind]} />
    </span>
  );
}
