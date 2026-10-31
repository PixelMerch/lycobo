import { expect, it, vi } from "vitest";
import { asyncInvocationRequest, startAsyncDrain } from "./cloudbase-wake";

const role = {
  TENCENTCLOUD_SECRETID: "AKIDfixture",
  TENCENTCLOUD_SECRETKEY: "fixture-secret-key",
  TENCENTCLOUD_SESSIONTOKEN: "fixture-token",
  TENCENTCLOUD_REGION: "ap-shanghai",
  SCF_FUNCTIONNAME: "lycobo-consumer",
  CLOUDBASE_ENV_ID: "lycobo-env",
};
it("signs an asynchronous invocation exactly like the Tencent Cloud API 3.0 SDK", () => {
  const [url, init] = asyncInvocationRequest(
    { secretId: "AKIDfixture", secretKey: "fixture-secret-key", token: "t" },
    { region: "ap-shanghai", namespace: "lycobo-env", functionName: "lycobo-consumer" },
    { drain: true },
    1793462400,
  );
  expect(url).toBe("https://scf.tencentcloudapi.com/");
  // Reference value produced by tencentcloud-sdk-nodejs-common Sign.sign3 for the same request.
  expect(init.headers).toMatchObject({
    Authorization:
      "TC3-HMAC-SHA256 Credential=AKIDfixture/2026-10-31/scf/tc3_request, SignedHeaders=content-type;host, Signature=b6a3ab7a89f7a74d4beade3828a53870a3ffb399a0eaf921dff4c70a23902205",
    "X-TC-Action": "Invoke",
    "X-TC-Region": "ap-shanghai",
    "X-TC-Timestamp": "1793462400",
    "X-TC-Token": "t",
  });
  expect(JSON.parse(String(init.body))).toEqual({
    FunctionName: "lycobo-consumer",
    Namespace: "lycobo-env",
    InvocationType: "Event",
    ClientContext: '{"drain":true}',
  });
});
it("queues a drain with the runtime role and reports refusals without throwing", async () => {
  const accepted = vi.fn(async () => Response.json({ Response: { RequestId: "fixture" } }));
  expect(await startAsyncDrain(role, { drain: true }, accepted)).toBe(true);
  expect(accepted).toHaveBeenCalledOnce();
  const refused = vi.fn(async () =>
    Response.json({ Response: { Error: { Code: "AuthFailure" }, RequestId: "fixture" } }),
  );
  expect(await startAsyncDrain(role, { drain: true }, refused)).toBe(false);
  const offline = vi.fn(async () => {
    throw new Error("offline");
  });
  expect(await startAsyncDrain(role, { drain: true }, offline)).toBe(false);
  const unused = vi.fn();
  expect(
    await startAsyncDrain({ ...role, TENCENTCLOUD_SECRETKEY: "" }, { drain: true }, unused),
  ).toBe(false);
  expect(unused).not.toHaveBeenCalled();
});
