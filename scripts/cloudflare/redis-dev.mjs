import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openLocalQueue } from "./redis-queue.mjs";

export async function startRedisBridge({
  redisUrl,
  token,
  port = 8790,
  apiOrigin = "http://127.0.0.1:8787",
  queueOptions = {},
}) {
  if (!token || token.length < 32) throw new Error("LOCAL_QUEUE_TOKEN_REQUIRED");
  const queue = await openLocalQueue({ url: redisUrl, ...queueOptions });
  let running = true;
  const abort = new AbortController();
  const callWorker = async (path, body, id) => {
    const response = await fetch(`${apiOrigin}/__local/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Delivery-Id": id ?? "maintenance",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(610000)]),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error("LOCAL_CONSUMER_UNAVAILABLE");
  };
  const server = createServer(async (request, response) => {
    try {
      if (request.url === "/health" && request.method === "GET") {
        await queue.ping();
        response.writeHead(200).end();
        return;
      }
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(403).end();
        return;
      }
      if (request.url !== "/enqueue" || request.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      let job;
      try {
        job = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.writeHead(400).end();
        return;
      }
      try {
        await queue.send(job);
      } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
          response.writeHead(400).end();
          return;
        }
        throw error;
      }
      response.writeHead(202).end();
    } catch {
      response.writeHead(503).end();
    }
  });
  try {
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", accept);
    });
  } catch (error) {
    await queue.close();
    throw error;
  }
  const loop = (async () => {
    let nextMaintenance = 0;
    while (running) {
      try {
        if (Date.now() >= nextMaintenance) {
          nextMaintenance = Date.now() + 30000;
          await callWorker("maintenance").catch(() => {});
        }
        const message = await queue.next();
        if (message) await queue.deliver(message, (job, id) => callWorker("consume", job, id));
        else await new Promise((accept) => setTimeout(accept, 100));
      } catch {
        if (running) console.error("LOCAL_REDIS_CONSUMER_UNAVAILABLE");
        await new Promise((accept) => setTimeout(accept, 1000));
      }
    }
  })();
  return {
    server,
    queue,
    async close() {
      running = false;
      abort.abort();
      await new Promise((accept) => server.close(accept));
      await loop;
      await queue.close();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bridge = await startRedisBridge({
    redisUrl: process.env.LOCAL_REDIS_URL,
    token: process.env.LOCAL_QUEUE_TOKEN,
  });
  console.info("Local Redis queue: ready (persistent Streams, loopback bridge)");
  let closing = false;
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      void bridge.close().catch(() => {
        process.exitCode = 1;
      });
    });
}
