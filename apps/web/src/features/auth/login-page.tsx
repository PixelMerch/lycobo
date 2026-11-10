import { Button, Link } from "@heroui/react";
import { IconBuilding, IconChevronRight, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageLoading } from "../../app/page-loading";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { type LegalDocumentId, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { useEnterpriseSession } from "./auth-client";
import { authMessages } from "./auth-messages";
import { EnterpriseLogin } from "./enterprise-login";
import { LoginBackdrop } from "./login-backdrop";
import { LoginMethods } from "./login-methods";
import { safeLoginReturnTo } from "./login-navigation";
import "../../styles/brand.css";
import "./login-page.css";

/** 独立全屏登录页：丝绸背景上居中一张登录卡片，以翻面切换登录方式，不叠加两套表单。 */
export function LoginPage() {
  const session = useEnterpriseSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeLoginReturnTo(params.get("returnTo"));
  if (session.isPending) return <PageLoading />;
  if (session.data && params.get("reauth") !== "1") return <Navigate to={returnTo} replace />;
  return (
    <main className="login-page" aria-labelledby="login-title">
      <LoginBackdrop />
      <LoginCard
        onClose={() => {
          void navigate("/", { replace: true });
        }}
        onLoginSuccess={() => {
          void navigate(returnTo, { replace: true });
        }}
      />
    </main>
  );
}

/** 固定尺寸的登录卡片：正面依次为 Google、Apple、邮箱与企业账号入口，翻面后只显示企业账号表单。 */
function LoginCard({
  onClose,
  onLoginSuccess,
}: {
  onClose: () => void;
  onLoginSuccess: () => void;
}) {
  const [enterprise, setEnterprise] = useState(false);
  // 只有从企业账号表单返回时才把焦点放回入口；首次打开不把焦点给这个次要入口。
  const [returned, setReturned] = useState(false);
  const reduceMotion = useReducedMotion();
  const t = useMessages(authMessages);
  return (
    <div className="login-panel">
      <Button
        isIconOnly
        size="lg"
        variant="ghost"
        className="login-close dialog-close"
        aria-label={t.closeLogin}
        onPress={onClose}
      >
        <UiIcon icon={IconX} size="action" />
      </Button>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={enterprise ? "enterprise" : "personal"}
          className="login-face"
          initial={{ opacity: 0, rotateY: reduceMotion ? 0 : 80 }}
          animate={{ opacity: 1, rotateY: 0 }}
          exit={{ opacity: 0, rotateY: reduceMotion ? 0 : -80 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeInOut" }}
        >
          <header className="login-header">
            <span className="login-logo-badge" aria-hidden="true">
              <img src="/brand/lycobo-product-pilot-mono.svg" alt="" width="36" height="26" />
            </span>
            <h1 id="login-title">{enterprise ? t.enterpriseTitle : t.title}</h1>
          </header>
          <div className="login-body">
            {enterprise ? (
              <EnterpriseLogin
                onBack={() => {
                  setEnterprise(false);
                  setReturned(true);
                }}
                onLoginSuccess={onLoginSuccess}
              />
            ) : (
              <>
                <LoginMethods />
                {/* 企业账号是次要入口，放在其他方式下方。 */}
                <Button
                  variant="ghost"
                  size="lg"
                  className="login-enterprise-trigger"
                  onPress={() => setEnterprise(true)}
                  autoFocus={returned}
                >
                  <UiIcon icon={IconBuilding} />
                  {t.enterpriseLogin}
                  <UiIcon icon={IconChevronRight} />
                </Button>
              </>
            )}
          </div>
          {enterprise && <p className="login-support">{t.support}</p>}
          <LoginAgreement />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** 卡片底部的协议提示：登录即表示同意用户协议与隐私政策；两份文本在新标签页打开，不打断登录。 */
function LoginAgreement() {
  const t = useMessages(authMessages);
  const legal = useMessages(legalMessages);
  const link = (id: LegalDocumentId) => (
    <Link
      href={legalPaths[id]}
      target="_blank"
      rel="noopener noreferrer"
      className="login-agreement-link"
      aria-label={t.agreementNewTab(legal.names[id])}
    >
      {t.agreementName(legal.names[id])}
    </Link>
  );
  return (
    <p className="login-agreement">
      {t.agreement.before}
      {link("terms")}
      {t.agreement.between}
      {link("privacy")}
      {t.agreement.after}
    </p>
  );
}
