import { Button, Link } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconBuilding, IconChevronRight, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageLoading } from "../../app/page-loading";
import { useCenteredDialogEntrance } from "../../components/overlays/use-centered-dialog-entrance";
import { UiIcon } from "../../components/ui-icon";
import { parseLocale } from "../../i18n/locale";
import { localizedPath } from "../../i18n/locale-path";
import { useLocale } from "../../i18n/locale-store";
import { currentMessages, useMessages } from "../../i18n/messages";
import { toast } from "../../lib/toast";
import { type LegalDocumentId, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { useEnterpriseSession } from "./auth-client";
import { authMessages } from "./auth-messages";
import { EnterpriseLogin } from "./enterprise-login";
import { LoginMethods } from "./login-methods";
import { safeLoginReturnTo } from "./login-navigation";
import "./login-page.css";

/** 独立登录页在桌面展示双栏卡片，并处理登录成功和关闭后的导航。 */
export function LoginPage() {
  const session = useEnterpriseSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const locale = useLocale();
  const surfaceMotion = useCenteredDialogEntrance();
  const backdropPress = useRef<{ id: number; x: number; y: number } | null>(null);
  const returnTo = safeLoginReturnTo(params.get("returnTo"));
  const destination = (user: EnterpriseIdentity) =>
    localizedPath(returnTo, parseLocale(user.preferredLocale) ?? locale);
  if (session.isPending) return <PageLoading />;
  if (session.data && params.get("reauth") !== "1")
    return (
      <SignedInRedirect
        to={destination(session.data)}
        socialSignedIn={params.get("oauth") === "success"}
      />
    );
  const closeLogin = () => {
    void navigate(localizedPath("/", locale), { replace: true });
  };
  return (
    <main
      className="login-page"
      aria-labelledby="login-title"
      onPointerDownCapture={(event) => {
        backdropPress.current =
          event.target === event.currentTarget && event.button === 0
            ? { id: event.pointerId, x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerUpCapture={(event) => {
        const start = backdropPress.current;
        backdropPress.current = null;
        // 只有在卡片外按下并轻点释放才返回，避免拖选内容时误关。
        if (
          start?.id === event.pointerId &&
          event.target === event.currentTarget &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4
        )
          closeLogin();
      }}
      onPointerCancelCapture={() => {
        backdropPress.current = null;
      }}
    >
      <motion.div className="login-shell" {...surfaceMotion}>
        <LoginMediaPanel />
        <section className="login-stage">
          <LoginCard
            returnTo={localizedPath(returnTo, locale)}
            socialFailed={params.get("oauth") === "failed"}
            onClose={closeLogin}
            onLoginSuccess={(user) => {
              void navigate(destination(user), { replace: true });
            }}
          />
        </section>
      </motion.div>
    </main>
  );
}

/** 在桌面登录卡片左侧轮播三张装饰图片。 */
function LoginMediaPanel() {
  return (
    <aside className="login-media" aria-hidden="true">
      <div className="login-media-slide login-media-slide--portrait" />
      <div className="login-media-slide login-media-slide--starry-night" />
      <div className="login-media-slide login-media-slide--cat" />
    </aside>
  );
}

/**
 * 已登录时离开登录页。Google、Apple 登录由服务端带 oauth=success 跳回这里，
 * 先用 Toast 提示“登录成功”，与邮箱、企业账号登录一致；其他情况直接离开、不提示。
 */
function SignedInRedirect({ to, socialSignedIn }: { to: string; socialSignedIn: boolean }) {
  // 开发模式下 StrictMode 会把副作用跑两遍，记一笔避免弹出两条提示。
  const announced = useRef(false);
  useEffect(() => {
    if (!socialSignedIn || announced.current) return;
    announced.current = true;
    toast.success(currentMessages(authMessages).signedIn);
  }, [socialSignedIn]);
  return <Navigate to={to} replace />;
}

/** 右侧登录容器：正面依次为 Google、Apple、邮箱与企业账号入口，切换后显示企业账号表单。 */
function LoginCard({
  returnTo,
  socialFailed,
  onClose,
  onLoginSuccess,
}: {
  returnTo: string;
  socialFailed: boolean;
  onClose: () => void;
  onLoginSuccess: (account: EnterpriseIdentity) => void;
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
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <header className="login-header">
            <span className="login-logo-badge" aria-hidden="true">
              <img src="/brand/lycobo-focus-mark.svg" alt="" width="48" height="48" />
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
                <LoginMethods
                  returnTo={returnTo}
                  failed={socialFailed}
                  onLoginSuccess={onLoginSuccess}
                />
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
  const locale = useLocale();
  const link = (id: LegalDocumentId) => (
    <Link
      href={localizedPath(legalPaths[id], locale)}
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
