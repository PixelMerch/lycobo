import {
  type AccountLocale,
  type AvatarPreset,
  apiErrorSchema,
  type EnterpriseIdentity,
  emailCodeVerifySchema,
  enterpriseAvatarChangeSchema,
  enterpriseIdentitySchema,
  enterpriseLocaleChangeSchema,
  enterpriseLoginResponseSchema,
  enterprisePasswordChangeSchema,
} from "@lycoboai/contracts";
import {
  type QueryClient,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseLocale } from "../../i18n/locale";
import { rememberLocale } from "../../i18n/locale-store";
import { currentMessages } from "../../i18n/messages";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { normalizeApiResponse } from "../../lib/api-response";
import { reportRequestFailure } from "../../lib/request-diagnostics";
import { serverErrorMessage } from "../../lib/server-error";
import { rememberSessionExpiry, resetSessionRenewal, sessionFetch } from "../../lib/session-fetch";
import { toast } from "../../lib/toast";
import { clearPreviewLinks } from "../generation/preview-link-cache";
import { authMessages } from "./auth-messages";

export const enterpriseSessionKey = ["enterprise-session"];
async function authRequest(path: string, init: RequestInit = {}, allowRenewal = true) {
  const useSession = allowRenewal && (path === "session" || path === "locale");
  const request = useSession ? sessionFetch : fetch;
  let response: Response;
  try {
    response = await request(`/api/v1/auth/${path}`, {
      ...init,
      credentials: "same-origin",
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (!useSession && !init.signal?.aborted)
      reportRequestFailure(`/api/v1/auth/${path}`, init.method ?? "GET");
    throw error;
  }
  if (!useSession && !response.ok)
    reportRequestFailure(`/api/v1/auth/${path}`, init.method ?? "GET", response);
  rememberSessionExpiry(response);
  return normalizeApiResponse(response);
}
/** 区分账号锁定，以便登录表单持续显示原因。 */
export class AccountLockedError extends Error {}

/** 区分人机验证失败和密码错误，让用户在表单内重新验证。 */
export class LoginVerificationError extends Error {}

async function authError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const envelope = apiErrorSchema.safeParse(body);
  if (envelope.success) {
    const message = serverErrorMessage(envelope.data);
    switch (envelope.data.error.code) {
      case "ACCOUNT_LOCKED":
        return new AccountLockedError(message);
      case "LOGIN_CHALLENGE_FAILED":
        return new LoginVerificationError(message);
      default:
        return new Error(message);
    }
  }
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    )
      return new Error(error.message);
  }
  return new Error(currentMessages(authMessages).serviceUnavailable);
}
function sessionQuery(allowRenewal = true) {
  return {
    queryKey: enterpriseSessionKey,
    retry: false,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await authRequest("session", { signal }, allowRenewal);
      if (response.status === 401 || response.status === 503) return null;
      if (!response.ok) throw new Error(currentMessages(authMessages).sessionUnavailable);
      return enterpriseIdentitySchema.parse(await response.json());
    },
  };
}

/** 读取当前登录状态，所有页面订阅同一份会话。 */
export function useEnterpriseSession() {
  return useQuery({ ...sessionQuery(), staleTime: 30000 });
}

/** 主动核验并更新登录状态，和已有会话查询共用正在进行的请求。 */
export function recheckEnterpriseSession(client: QueryClient, allowRenewal = true) {
  return client.fetchQuery({ ...sessionQuery(allowRenewal), staleTime: 0 });
}
/** 登录后同步账号偏好和会话，清理旧身份的业务查询。 */
export function useEnterpriseLogin() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (input: { account: string; password: string; captchaToken: string }) => {
      resetSessionRenewal();
      const response = await authRequest("enterprise/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await authError(response);
      // 浏览器通过 HttpOnly Cookie 使用凭据，前端只保留身份资料。
      return enterpriseLoginResponseSchema.parse(await response.json()).user;
    },
    onSuccess: (user) => syncLoginSession(client, user),
  });
}

async function syncLoginSession(client: QueryClient, user: EnterpriseIdentity) {
  clearPreviewLinks();
  const savedLocale = parseLocale(user.preferredLocale);
  if (savedLocale) rememberLocale(savedLocale);
  await client.cancelQueries();
  client.setQueryData(enterpriseSessionKey, user);
  // 重置会让已挂载的查询用新会话重查，避免继续订阅旧身份的数据。
  await client.resetQueries({
    predicate: (query) => query.queryKey[0] !== enterpriseSessionKey[0],
  });
}

/** 验证邮箱验证码，并把返回的身份同步到共用登录会话。 */
export function useEmailCodeLogin() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (input: { email: string; code: string }) => {
      const response = await authRequest("email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailCodeVerifySchema.parse(input)),
      });
      const t = currentMessages(authMessages);
      if (response.status === 429) throw new Error(t.emailRateLimited);
      if (response.status === 401) throw new Error(t.emailCodeInvalid);
      if (!response.ok) throw new Error(t.serviceUnavailable);
      resetSessionRenewal();
      rememberSessionExpiry(response);
      return enterpriseIdentitySchema.parse(await response.json());
    },
    onSuccess: (user) => syncLoginSession(client, user),
  });
}

/** 退出登录后直接回到当前语言的首页，并清理旧身份的缓存。 */
export function useEnterpriseLogout() {
  const client = useQueryClient();
  const navigate = useAppNavigate();
  return useMutation({
    mutationFn: async () => {
      resetSessionRenewal();
      const response = await authRequest("logout", { method: "POST" });
      if (!response.ok) throw new Error(currentMessages(authMessages).logoutFailed);
    },
    // 三处退出入口（账户菜单、设置侧栏、手机设置页）共用这里的提示，组件卸载后也会执行。
    onSuccess: async () => {
      // 先离开受保护的工作区，避免会话清除时触发去登录页的导航。
      await navigate("/", { replace: true });
      await clearEnterpriseSession(client);
      toast.success(currentMessages(authMessages).signedOut);
    },
  });
}

async function clearEnterpriseSession(client: QueryClient) {
  clearPreviewLinks();
  await client.cancelQueries();
  client.setQueryData(enterpriseSessionKey, null);
  // 清除旧身份的缓存，避免尚未卸载的页面在退出后立即重查私有接口。
  for (const query of client.getQueryCache().findAll({
    predicate: (query) => query.queryKey[0] !== enterpriseSessionKey[0],
  })) {
    query.reset();
  }
}

/** 保存预设头像；成功后用服务端返回的身份更新登录状态，各处头像立即同步。 */
export function useEnterpriseAvatar() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (avatarPreset: AvatarPreset | null) => {
      const body = enterpriseAvatarChangeSchema.parse({ avatarPreset });
      const response = await authRequest("avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await authError(response);
      // 返回内容不完整时给出通用提示，不把校验细节显示给用户。
      const user = enterpriseIdentitySchema.safeParse(await response.json());
      if (!user.success) throw new Error(currentMessages(authMessages).serviceUnavailable);
      return user.data;
    },
    onSuccess: (user) => updateSessionPreference(client, user, { avatarPreset: user.avatarPreset }),
  });
}
async function updateSessionPreference(
  client: QueryClient,
  user: EnterpriseIdentity,
  preference: Pick<EnterpriseIdentity, "avatarPreset" | "preferredLocale">,
) {
  await client.cancelQueries({ queryKey: enterpriseSessionKey });
  client.setQueryData<EnterpriseIdentity | null>(enterpriseSessionKey, (current) =>
    current?.userId === user.userId ? { ...current, ...preference } : current,
  );
}

const localeMutationKey = ["enterprise-locale"];

/** 保存账号语言并同步会话；不同入口共享保存状态。 */
export function useEnterpriseLocale(userId?: string) {
  const client = useQueryClient();
  const filter = { mutationKey: localeMutationKey };
  const isSaving = useIsMutating(filter) > 0;
  const mutation = useMutation({
    ...filter,
    retry: false,
    mutationFn: async (preferredLocale: AccountLocale) => {
      const body = enterpriseLocaleChangeSchema.parse({ preferredLocale });
      const response = await authRequest("locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await authError(response);
      const user = enterpriseIdentitySchema.safeParse(await response.json());
      if (
        !user.success ||
        user.data.userId !== userId ||
        user.data.preferredLocale !== preferredLocale
      )
        throw new Error(currentMessages(authMessages).serviceUnavailable);
      return user.data;
    },
    onSuccess: (user) =>
      updateSessionPreference(client, user, { preferredLocale: user.preferredLocale }),
  });
  return { mutation, isSaving };
}

/** 修改密码；成功后清空登录状态，所有设备需要重新登录。 */
export function useEnterprisePasswordChange() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const validated = enterprisePasswordChangeSchema.parse(input);
      const response = await authRequest("password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!response.ok) throw await authError(response);
    },
    onSuccess: async () => {
      resetSessionRenewal();
      toast.success(currentMessages(authMessages).passwordChanged);
      await clearEnterpriseSession(client);
    },
  });
}
