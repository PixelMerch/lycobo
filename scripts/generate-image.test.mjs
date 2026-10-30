import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { apiOrigin, generateImage, imageExtension, imageSize } from "../generate-image/client.mjs";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const options = () => ({
  origin: "https://provider.example",
  key: "fixture-secret",
  model: "gpt-image-2.5",
  prompt: "商品摄影",
  size: "1254x1254",
  saveReceipt: vi.fn(),
  wait: vi.fn(),
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
describe("agent image generation tool", () => {
  it("normalizes tiers and rejects invalid dimensions and origins", () => {
    expect(imageSize("1.5K")).toBe("1254x1254");
    expect(imageSize("4k")).toBe("3840x3840");
    expect(imageSize("2880x3840")).toBe("2880x3840");
    expect(() => imageSize("4096x4096")).toThrow();
    expect(apiOrigin("https://provider.example/v1")).toBe("https://provider.example");
    expect(() => apiOrigin("https://user:secret@provider.example")).toThrow();
  });
  it("handles synchronous base64 results and submits a single image", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(json({ data: [{ b64_json: png.toString("base64") }] }));
    expect(await generateImage({ ...options(), request })).toEqual(png);
    expect(request).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(request.mock.calls[0][1].body);
    expect(sent).toMatchObject({ n: 1, size: "1254x1254", async: true });
    expect(imageExtension(png)).toBe(".png");
  });
  it("polls accepted tasks without resubmitting and never leaks the key to a CDN", async () => {
    const opts = options();
    const request = vi
      .fn()
      .mockResolvedValueOnce(json({ task_id: "t1", status: "queued", poll_after_ms: 1 }, 202))
      .mockResolvedValueOnce(
        json({ task_id: "t1", status: "success", result_url: "/v1/images/tasks/t1" }),
      )
      .mockResolvedValueOnce(
        json({ status: "success", assets: [{ signed_url: "https://cdn.example/image.png" }] }),
      )
      .mockResolvedValueOnce(new Response(png));
    expect(await generateImage({ ...opts, request })).toEqual(png);
    expect(request.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
    expect(request.mock.calls[2][0].search).toBe("");
    expect(request.mock.calls[3][1].headers).toEqual({});
    expect(opts.saveReceipt.mock.calls.at(-1)[0]).not.toHaveProperty("key");
    expect(opts.saveReceipt.mock.calls.at(-1)[0]).not.toHaveProperty("prompt");
  });
  it("resumes only GET queries and rejects cross-origin status URLs", async () => {
    const opts = options();
    const receipt = {
      origin: opts.origin,
      statusUrl: `${opts.origin}/v1/images/tasks/t1`,
      idempotencyKey: "stable",
    };
    const request = vi
      .fn()
      .mockResolvedValue(json({ data: [{ b64_json: png.toString("base64") }] }));
    await generateImage({ ...opts, receipt, request });
    expect(request.mock.calls[0][1].method).toBe("GET");
    await expect(
      generateImage({
        ...opts,
        receipt: { ...receipt, statusUrl: "https://evil.example/v1/images/tasks/t1" },
        request,
      }),
    ).rejects.toThrow("不可信");
  });
  it("never retries ambiguous paid submissions or accepts non-image downloads", async () => {
    const request = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(generateImage({ ...options(), request })).rejects.toThrow("timeout");
    expect(request).toHaveBeenCalledTimes(1);
    const html = Buffer.from("<html>error</html>");
    expect(() => imageExtension(html)).toThrow();
    const failed = vi.fn().mockResolvedValue(json({ status: "failed" }));
    await expect(generateImage({ ...options(), request: failed })).rejects.toThrow("failed");
    expect(failed).toHaveBeenCalledTimes(1);
  });
});

it("CLI creates directories, saves the real image format and refuses existing files", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "lycobo-agent-image-"));
  try {
    const bootstrap = resolve(root, "mock-fetch.mjs");
    await writeFile(
      bootstrap,
      `globalThis.fetch = async () => new Response(JSON.stringify({data:[{b64_json:"${png.toString("base64")}"}]}));`,
    );
    const folder = resolve(root, "nested", "images");
    const args = [
      "--import",
      bootstrap,
      resolve("generate-image/generate.mjs"),
      "--resolution",
      "1.5K",
      "--prompt",
      "商品摄影",
      "--folder",
      folder,
      "--filename",
      "cup",
    ];
    const env = {
      ...process.env,
      GENERATE_IMAGE_BASE_URL: "https://provider.example/v1",
      GENERATE_IMAGE_API_KEY: "fixture-only",
    };
    const { stdout } = await promisify(execFile)(process.execPath, args, { env });
    expect(JSON.parse(stdout).path).toBe(resolve(folder, "cup.png"));
    expect(await readFile(resolve(folder, "cup.png"))).toEqual(png);
    await expect(promisify(execFile)(process.execPath, args, { env })).rejects.toMatchObject({
      code: 1,
    });
    expect(await readFile(resolve(folder, "cup.png"))).toEqual(png);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
