import { createHash, createHmac } from "node:crypto";
import { z } from "zod";

const host = "scf.tencentcloudapi.com";
const contentType = "application/json; charset=utf-8";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: string | Buffer, value: string) =>
  createHmac("sha256", key).update(value).digest();

/** Tencent Cloud API 3.0 (TC3-HMAC-SHA256) request that queues an asynchronous SCF invocation. */
export function asyncInvocationRequest(
  credentials: { secretId: string; secretKey: string; token?: string | undefined },
  target: { region: string; namespace: string; functionName: string },
  event: Record<string, unknown>,
  timestamp: number,
): [string, RequestInit] {
  const body = JSON.stringify({
    FunctionName: target.functionName,
    Namespace: target.namespace,
    InvocationType: "Event",
    ClientContext: JSON.stringify(event),
  });
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const scope = `${date}/scf/tc3_request`;
  const canonical = `POST\n/\n\ncontent-type:${contentType}\nhost:${host}\n\ncontent-type;host\n${sha256(body)}`;
  const key = hmac(hmac(hmac(`TC3${credentials.secretKey}`, date), "scf"), "tc3_request");
  const signature = createHmac("sha256", key)
    .update(`TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${sha256(canonical)}`)
    .digest("hex");
  return [
    `https://${host}/`,
    {
      method: "POST",
      headers: {
        Authorization: `TC3-HMAC-SHA256 Credential=${credentials.secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`,
        "Content-Type": contentType,
        "X-TC-Action": "Invoke",
        "X-TC-Version": "2018-04-16",
        "X-TC-Region": target.region,
        "X-TC-Timestamp": String(timestamp),
        ...(credentials.token ? { "X-TC-Token": credentials.token } : {}),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    },
  ];
}

const responseSchema = z.object({ Response: z.object({ Error: z.unknown().optional() }) });
/**
 * Queues an asynchronous drain of this Event function with the runtime role's temporary
 * credentials, which SCF injects per invocation. False leaves the work to the timer.
 */
export async function startAsyncDrain(
  env: NodeJS.ProcessEnv,
  event: { drain: true; resumeAt?: number },
  request: typeof fetch = fetch,
  now = Date.now,
) {
  const {
    TENCENTCLOUD_SECRETID: secretId,
    TENCENTCLOUD_SECRETKEY: secretKey,
    TENCENTCLOUD_SESSIONTOKEN: token,
    TENCENTCLOUD_REGION: region,
    SCF_FUNCTIONNAME: functionName,
    CLOUDBASE_ENV_ID: namespace,
  } = env;
  if (!secretId || !secretKey || !region || !functionName || !namespace) return false;
  try {
    const response = await request(
      ...asyncInvocationRequest(
        { secretId, secretKey, token },
        { region, namespace, functionName },
        event,
        Math.floor(now() / 1000),
      ),
    );
    const result = responseSchema.safeParse(await response.json());
    return response.ok && result.success && result.data.Response.Error === undefined;
  } catch {
    return false;
  }
}
