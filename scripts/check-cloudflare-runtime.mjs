import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRealtimeRuntime } from "./realtime-runtime.mjs";

// Separate local fixture Worker: no Hyperdrive, production bucket, secrets or model calls.
const state = await mkdtemp(join(tmpdir(), "lycobo-workerd-"));
const child = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--config",
    "tests/wrangler.runtime.jsonc",
    "--local",
    "--port",
    "0",
    "--persist-to",
    state,
  ],
  { detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] },
);
if (process.env.DEBUG_RUNTIME) child.stderr.on("data", (chunk) => process.stderr.write(chunk));
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WORKER_START_TIMEOUT")), 45000);
    let output = "";
    const observe = (chunk) => {
      output = (output + chunk.toString()).slice(-20000);
      const matched = output.match(/Ready on (http:\/\/(?:localhost|127\.0\.0\.1):\d+)/);
      if (matched) {
        clearTimeout(timer);
        resolve(matched[1]);
      }
    };
    child.stdout.on("data", observe);
    child.stderr.on("data", observe);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`WORKER_EXIT_${code}`));
    });
  });
  await verifyRealtimeRuntime(url);
  const optimizer = await (
    await fetch(`${url}/optimizer-runtime`, { signal: AbortSignal.timeout(5000) })
  ).json();
  assert.equal(optimizer.optimized, true, "Prompt optimization failed inside workerd");
  assert.equal(optimizer.requests, 1);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.passwordVerified, true);
  assert.equal(result.width, 2);
  assert(result.storedBytes > 0);
  let queueCompleted = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await (
      await fetch(`${url}/queue-result?id=${result.runId}`, { signal: AbortSignal.timeout(5000) })
    ).json();
    if (status.completed) {
      queueCompleted = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert(queueCompleted, "Local Queue did not persist its result");
  console.info(
    "Local workerd verified prompt optimization request options, scrypt credentials, Images decoding/WebP output, private R2 writes and Queue delivery (fixture only)",
  );
} finally {
  if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
  else child.kill("SIGTERM");
  await rm(state, { recursive: true, force: true });
}
