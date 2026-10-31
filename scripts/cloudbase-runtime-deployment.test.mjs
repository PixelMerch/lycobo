import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  decodeToolResult,
  deploymentCosCredentials,
  publishRuntime,
  validateUpload,
} from "./cloudbase/deploy-runtime.mjs";

const name = "lycobo-consumer";
const upload = (suffix = "0123456789abcdef") => {
  const key = `fnzip-upload/1793450000-${suffix}/${name}.zip`;
  return {
    cosBucketName: "example-code",
    cosBucketRegion: "ap-shanghai",
    cosObjectName: key,
    uploadUrl: `https://example-code-1234567890.cos.ap-shanghai.myqcloud.com/${key}?q-signature=private`,
    uploadHeaders: [],
  };
};
describe("CloudBase runtime code publishing", () => {
  it("uses CI credentials without calling the temporary-session-only interface", async () => {
    const call = vi.fn(async () => {
      throw new Error("UNSUPPORTED_CREDENTIAL_TYPE");
    });
    await expect(
      deploymentCosCredentials(
        { TCB_SECRET_ID: "AKIDfixture", TCB_SECRET_KEY: "fixture-only" },
        call,
      ),
    ).resolves.toEqual({ SecretId: "AKIDfixture", SecretKey: "fixture-only" });
    expect(call).not.toHaveBeenCalled();
    await expect(deploymentCosCredentials({ TCB_SECRET_ID: "AKIDfixture" }, call)).rejects.toThrow(
      "CODE_UPLOAD_CREDENTIALS_UNAVAILABLE",
    );
    expect(call).not.toHaveBeenCalled();
  });
  it("retains the explicit temporary-session path for local device authorization", async () => {
    const call = vi.fn(async () => ({
      credentials: {
        secretId: "local-fixture",
        secretKey: "fixture-only",
        token: "temporary-fixture",
        masked: false,
      },
    }));
    await expect(deploymentCosCredentials({}, call)).resolves.toMatchObject({
      SecretId: "local-fixture",
      SecurityToken: "temporary-fixture",
    });
    expect(call).toHaveBeenCalledWith("auth", {
      action: "get_temp_credentials",
      confirm: "yes",
      reveal: true,
    });
  });
  it("does not forward raw tool errors containing credentials or signed URLs", () => {
    expect(() =>
      decodeToolResult(
        {
          isError: true,
          content: [{ type: "text", text: '{"success":false,"message":"private credential"}' }],
        },
        "update",
      ),
    ).toThrow("update: TOOL_OPERATION_FAILED");
    expect(() =>
      decodeToolResult({ content: [{ type: "text", text: "private credential" }] }, "update"),
    ).toThrow("update: INVALID_TOOL_RESPONSE");
  });
  it("restricts upload capabilities to the bound region, bucket, function and object prefix", () => {
    expect(validateUpload(upload(), name).url.protocol).toBe("https:");
    for (const changed of [
      { ...upload(), uploadUrl: "https://evil.example/upload" },
      { ...upload(), cosBucketName: "other-bucket" },
      { ...upload(), cosObjectName: "existing-user-image.png" },
      { ...upload(), uploadHeaders: [{ Key: "Authorization", Value: "private" }] },
    ])
      expect(() => validateUpload(changed, name)).toThrow();
  });
  it.each(["signed-put", "multipart"])(
    "%s refreshes failed transfers before updating code",
    async (mode) => {
      const root = await mkdtemp(path.join(tmpdir(), "lycobo-code-publish-test-"));
      try {
        await mkdir(path.join(root, name));
        await mkdir(path.join(root, "archives"));
        await writeFile(
          path.join(root, name, "index.js"),
          "exports.main=async()=>({enabled:false});",
        );
        let reads = 0,
          capabilities = 0;
        const call = vi.fn(async (_tool, args) => {
          if (args.action === "getFunctionDetail")
            return {
              data: {
                functionDetail: { Status: "Active", ModTime: reads++ === 0 ? "before" : "after" },
              },
            };
          if (args.action === "getFunctionUploadUrl")
            return { data: upload(capabilities++ === 0 ? "0123456789abcdef" : "fedcba9876543210") };
          return { success: true };
        });
        const request = vi
          .fn()
          .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
          .mockResolvedValueOnce(new Response(null, { status: 200 }));
        const cleanup = vi.fn(async () => {});
        const uploadArchive = vi
          .fn()
          .mockRejectedValueOnce(new Error("UPLOAD_TRANSIENT"))
          .mockResolvedValueOnce(undefined);
        await publishRuntime({
          call,
          root,
          archiveDirectory: path.join(root, "archives"),
          request,
          wait: async () => {},
          functions: [name],
          removeUploadedObject: cleanup,
          ...(mode === "multipart" ? { uploadArchive } : {}),
        });
        if (mode === "signed-put") {
          expect(request).toHaveBeenCalledTimes(2);
          expect(request.mock.calls[0][0].href).not.toBe(request.mock.calls[1][0].href);
        } else {
          expect(request).not.toHaveBeenCalled();
          expect(uploadArchive).toHaveBeenCalledTimes(2);
          expect(uploadArchive.mock.calls[0][0].cosObjectName).not.toBe(
            uploadArchive.mock.calls[1][0].cosObjectName,
          );
          expect(uploadArchive.mock.calls[1].slice(1)).toEqual([
            name,
            path.join(root, "archives", `${name}.zip`),
          ]);
        }
        const updates = call.mock.calls.filter(([tool]) => tool === "manageFunctions");
        expect(updates).toHaveLength(1);
        expect(updates[0][1]).not.toHaveProperty("func");
        expect(updates[0][1].code.cosObjectName).toContain("fedcba9876543210");
        expect(cleanup).toHaveBeenCalledOnce();
        expect(cleanup.mock.calls[0][0].cosObjectName).toContain("fedcba9876543210");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
