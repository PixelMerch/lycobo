import { MembershipSummary } from "./account-overview";
import { MembershipFaq } from "./membership-faq";
import "./membership-page.css";

/** Membership status and answers; plans open in the full-screen membership view. */
export function AccountMembership() {
  return (
    <div className="account-membership">
      <MembershipSummary />
      <MembershipFaq />
    </div>
  );
}
