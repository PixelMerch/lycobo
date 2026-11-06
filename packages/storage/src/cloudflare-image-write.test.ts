import { afterEach, expect, it, vi } from "vitest";
import { persistImageOutput, preserveAndNormalize } from "./cloudflare-image-write";
import type { ImageObjectBucket } from "./object-bucket";

const key =
  "1234567890/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.png";
const bytes = new Uint8Array([1, 2, 3]);
function bucketFixture(): ImageObjectBucket {
  return {
    head: vi.fn(async () => null),
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}
function deferred() {
  let resolve: () => void = () => {
    throw new Error("PROMISE_NOT_READY");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("PROMISE_NOT_READY");
  };
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) };
}
afterEach(() => vi.useRealTimers());
it("starts original and both variant writes together, and awaits every successful object", async () => {
  const bucket = bucketFixture();
  const release = deferred();
  vi.mocked(bucket.put).mockImplementation(() => release.promise);
  const encode = vi.fn(async () => bytes);
  const work = persistImageOutput(bucket, { encode }, key, bytes, undefined);
  await vi.waitFor(() => expect(bucket.put).toHaveBeenCalledTimes(3));
  expect(encode).toHaveBeenCalledTimes(2);
  expect(bucket.delete).not.toHaveBeenCalled();
  release.resolve();
  await work;
});
it("waits for remaining writes on failure instead of leaving background work", async () => {
  const bucket = bucketFixture();
  const release = deferred();
  vi.mocked(bucket.put).mockImplementation((name) =>
    name.endsWith(".thumbnail.webp") ? Promise.reject(new Error("WRITE_FAILED")) : release.promise,
  );
  const settled = vi.fn();
  const work = persistImageOutput(
    bucket,
    { encode: async () => bytes },
    key,
    bytes,
    undefined,
  ).then(settled, (error) => {
    settled();
    return error;
  });
  await vi.waitFor(() => expect(bucket.put).toHaveBeenCalledTimes(3));
  expect(settled).not.toHaveBeenCalled();
  release.resolve();
  expect(await work).toMatchObject({ message: "WRITE_FAILED" });
  expect(bucket.delete).not.toHaveBeenCalled();
});
it("conversion failure still waits for and preserves the paid source", async () => {
  const bucket = bucketFixture();
  const release = deferred();
  vi.mocked(bucket.put).mockImplementation(() => release.promise);
  const settled = vi.fn();
  const work = preserveAndNormalize(bucket, key, bytes, async () => {
    throw new Error("DECODE_FAILED");
  }).then(settled, (error) => {
    settled();
    return error;
  });
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  release.resolve();
  expect(await work).toMatchObject({ message: "DECODE_FAILED" });
  expect(bucket.put).toHaveBeenCalledWith(`${key}.source`, bytes, expect.anything());
  expect(bucket.delete).not.toHaveBeenCalled();
});
it("controlled latency follows the longest write branch rather than the sum", async () => {
  vi.useFakeTimers();
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const bucket = bucketFixture();
  vi.mocked(bucket.put).mockImplementation(() => delay(150));
  const encode = async () => {
    await delay(60);
    return bytes;
  };
  const started = Date.now();
  const parallel = persistImageOutput(bucket, { encode }, key, bytes, undefined);
  await vi.runAllTimersAsync();
  await parallel;
  const parallelMs = Date.now() - started;
  const serialStarted = Date.now();
  const serial = (async () => {
    await bucket.put(key, bytes);
    for (const variant of ["thumbnail", "preview"]) {
      await encode();
      await bucket.put(`${key}.${variant}`, bytes);
    }
  })();
  await vi.runAllTimersAsync();
  await serial;
  expect(parallelMs).toBe(210);
  expect(Date.now() - serialStarted).toBe(570);
});
it("normalization and source preservation overlap without suppressing source write failure", async () => {
  const bucket = bucketFixture();
  const source = deferred();
  vi.mocked(bucket.put).mockImplementation(() => source.promise);
  const normalize = vi.fn(async () => bytes);
  const work = preserveAndNormalize(bucket, key, bytes, normalize);
  expect(normalize).toHaveBeenCalledTimes(1);
  source.reject(new Error("SOURCE_WRITE_FAILED"));
  await expect(work).rejects.toThrow("SOURCE_WRITE_FAILED");
});
