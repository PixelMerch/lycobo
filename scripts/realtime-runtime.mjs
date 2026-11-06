import assert from "node:assert/strict";
import { request } from "node:http";
import { createRequire } from "node:module";

const requireWrangler = createRequire(import.meta.resolve("wrangler"));
const { WebSocket } = requireWrangler("ws");

/** 在真实 workerd 中验证握手中间件、休眠心跳、租户隔离、去重和断线回放。 */
export async function verifyRealtimeRuntime(url) {
  const publish = async (input) => {
    const response = await fetch(`${url}/fixture/publish`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
  };
  const headers = {
    Origin: url,
    Upgrade: "websocket",
    Cookie: "lycobo_enterprise_session=fixture",
  };
  const rejected = async (headers) =>
    new Promise((resolve, reject) => {
      const call = request(`${url}/api/v1/realtime/connect`, { headers }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      call.on("error", reject);
      call.end();
    });
  assert.equal(await rejected({ ...headers, Origin: "https://evil.example" }), 403);
  assert.equal(await rejected({ Origin: url, Upgrade: "websocket" }), 401);
  const fresh = crypto.randomUUID();
  const open = async (cursor = "0") => {
    // Node 内置 WebSocket 不提供 Cookie 选项，使用已安装的 ws 测试客户端。

    const socket = new WebSocket(
      `${url.replace("http", "ws")}/api/v1/realtime/connect?cursor=${cursor}`,
      { headers },
    );
    const messages = [];
    socket.on("message", (data) => messages.push(data.toString()));
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
      socket.once("unexpected-response", (_request, response) => {
        response.on("data", (chunk) => console.error(chunk.toString().slice(0, 2000)));
        response.on("end", () => reject(new Error(`UPGRADE_${response.statusCode}`)));
      });
    });
    return { socket, messages };
  };
  const waitFor = async (predicate) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("REALTIME_FRAME_TIMEOUT");
  };
  const first = await open();
  try {
    await waitFor(() => first.messages.some((text) => text.includes('"type":"ready"')));
    first.socket.send("ping");
    await waitFor(() => first.messages.includes("pong"));
    const id = crypto.randomUUID();
    const input = { id, event: { id: crypto.randomUUID(), kind: "wallet" } };
    await publish(input);
    await waitFor(() => first.messages.some((text) => text.includes(input.event.id)));
    const frame = JSON.parse(first.messages.find((text) => text.includes(input.event.id)));
    await publish(input);
    await publish({
      id: crypto.randomUUID(),
      event: { id: fresh, kind: "wallet" },
      channel: crypto.randomUUID(),
    });
    await publish({
      id: crypto.randomUUID(),
      event: { id: crypto.randomUUID(), kind: "notification" },
      userId: crypto.randomUUID(),
    });
    assert.ok(!first.messages.some((text) => text.includes(fresh)));
    // 允许至少一次广播，但游标和事件身份必须相同，客户端据此幂等应用。
    const matching = first.messages
      .filter((text) => text.includes(input.event.id))
      .map((text) => JSON.parse(text).cursor);
    assert.ok(matching.every((cursor) => cursor === frame.cursor));
    first.socket.close();
    const missed = {
      id: crypto.randomUUID(),
      event: { id: crypto.randomUUID(), kind: "notification" },
    };
    await publish(missed);
    const second = await open(frame.cursor);
    try {
      await waitFor(() => second.messages.some((text) => text.includes(missed.event.id)));
      assert.ok(!second.messages.some((text) => text.includes(input.event.id)));
      const ready = second.messages.find((text) => text.includes('"type":"ready"'));
      assert.ok(ready);
      assert.equal(JSON.parse(ready).resync, false);
      const closed = new Promise((resolve) =>
        second.socket.once("close", (code) => {
          assert.equal(code, 4001);
          resolve();
        }),
      );
      await publish({
        id: crypto.randomUUID(),
        event: { id: crypto.randomUUID(), kind: "wallet" },
        sessions: [],
      });
      await closed;
    } finally {
      second.socket.close();
    }
  } finally {
    first.socket.close();
  }
  console.info(
    "Local workerd verified WebSocket upgrade, automatic heartbeat, isolation, stable cursors, replay and revoked-session closure",
  );
}
