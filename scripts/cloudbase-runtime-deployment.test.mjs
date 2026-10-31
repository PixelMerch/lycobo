import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decodeToolResult, publishRuntime, validateUpload } from "./cloudbase/deploy-runtime.mjs";

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
  it("refreshes transient failed uploads and updates code only after successful transfer", async () => {
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
      await publishRuntime({
        call,
        root,
        archiveDirectory: path.join(root, "archives"),
        request,
        wait: async () => {},
        functions: [name],
        removeUploadedObject: cleanup,
      });
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls[0][0].href).not.toBe(request.mock.calls[1][0].href);
      const updates = call.mock.calls.filter(([tool]) => tool === "manageFunctions");
      expect(updates).toHaveLength(1);
      expect(updates[0][1]).not.toHaveProperty("func");
      expect(updates[0][1].code.cosObjectName).toContain("fedcba9876543210");
      expect(cleanup).toHaveBeenCalledOnce();
      expect(cleanup.mock.calls[0][0].cosObjectName).toContain("fedcba9876543210");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
