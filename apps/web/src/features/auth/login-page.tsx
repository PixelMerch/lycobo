import { Button } from "@heroui/react";
import { IconBuilding, IconChevronRight, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageLoading } from "../../app/page-loading";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseSession } from "./auth-client";
import { EnterpriseLogin } from "./enterprise-login";
import { LoginMethods } from "./login-methods";
import { safeLoginReturnTo } from "./login-navigation";
import "../../styles/brand.css";

/** 独立全屏登录页以翻面切换登录方式，不叠加两套表单。 */
export function LoginPage() {
  const [enterprise, setEnterprise] = useState(false);
  const reduceMotion = useReducedMotion();
  const session = useEnterpriseSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeLoginReturnTo(params.get("returnTo"));
  if (session.isPending) return <PageLoading />;
  if (session.data && params.get("reauth") !== "1") return <Navigate to={returnTo} replace />;
  return (
    <main className="login-page" aria-labelledby="login-title">
      <div className="login-background" aria-hidden="true" />
      <div className="login-panel">
        <Button
          isIconOnly
          size="lg"
          variant="ghost"
          className="login-close"
          aria-label="关闭登录"
          onPress={() => {
            void navigate("/", { replace: true });
          }}
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
              <span className="login-brand-mark" aria-hidden="true">
                <img src="/brand/lycobo-product-pilot-mark.svg" alt="" width="44" height="34" />
              </span>
              <h1 id="login-title">{enterprise ? "企业账号登录" : "登录 Lycobo"}</h1>
              <p>{enterprise ? "使用企业账号和密码登录" : "开启你的电商创作"}</p>
            </header>
            <div className="login-body">
              {enterprise ? (
                <EnterpriseLogin
                  onBack={() => setEnterprise(false)}
                  onLoginSuccess={() => {
                    void navigate(returnTo, { replace: true });
                  }}
                />
              ) : (
                <>
                  <LoginMethods />
                  <Button
                    variant="ghost"
                    size="lg"
                    className="login-enterprise-trigger"
                    onPress={() => setEnterprise(true)}
                    autoFocus
                  >
                    <UiIcon icon={IconBuilding} />
                    企业账号登录
                    <UiIcon icon={IconChevronRight} />
                  </Button>
                </>
              )}
            </div>
            <p className="login-support">账号问题请联系企业管理员</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
