import { DurableObject } from "cloudflare:workers";
import {
  type RealtimeOutboxMessage,
  realtimeCursorSchema,
  realtimeOutboxMessageSchema,
  releaseSchema,
  sessionReplacedCloseCode,
} from "@lycoboai/contracts";
import { z } from "zod";

type Release = ReturnType<typeof releaseSchema.parse>;
const attachmentSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  expiresAt: z.number(),
});
type Connection = z.infer<typeof attachmentSchema>;
type StoredEvent = { cursor: number; event_id: string; user_id: string | null; payload: string };
const revokedSessionRetention = 24 * 60 * 60 * 1000;

/** 每个组织独立的可休眠连接与短期消息日志，不在空闲时持有数据库连接。 */
export class RealtimeHub extends DurableObject<CloudflareEnv> {
  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS events (
      cursor INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,user_id TEXT,payload TEXT NOT NULL)`);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY,created_at INTEGER NOT NULL)`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS revoked_sessions (id TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)`,
    );
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** 升级响应包含不可 RPC 序列化的 WebSocket，必须通过内部 fetch 返回。 */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response(null, { status: 426 });
    const input = z
      .object({
        connection: attachmentSchema,
        cursor: realtimeCursorSchema,
        release: releaseSchema.nullable(),
      })
      .parse(JSON.parse(request.headers.get("X-Realtime-Connection") ?? "null"));
    return this.openSocket(input.connection, input.cursor, input.release);
  }

  /** 仅供已鉴权主 Worker 调用，身份来自会话而非浏览器参数。 */
  private async openSocket(
    connection: Connection,
    cursor: string,
    release: Release | null,
  ): Promise<Response> {
    attachmentSchema.parse(connection);
    realtimeCursorSchema.parse(cursor);
    // 防止在数据库撤销之前通过验证的旧握手晚于退出通知抵达。
    if (
      this.ctx.storage.sql
        .exec(
          "SELECT 1 FROM revoked_sessions WHERE id=? AND expires_at>?",
          connection.sessionId,
          Date.now(),
        )
        .toArray().length
    )
      return new Response(null, { status: 401 });
    const active = this.ctx.getWebSockets(connection.userId);
    if (active.length >= 8) return new Response("连接数量已达上限", { status: 429 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [connection.userId]);
    server.serializeAttachment(connection);
    const range = this.ctx.storage.sql
      .exec<{ first: number | null; last: number | null }>(
        "SELECT min(cursor) AS first,max(cursor) AS last FROM events",
      )
      .one();
    const last = String(range.last ?? 0);
    const resync =
      (cursor === "0" && last !== "0") ||
      BigInt(cursor) > BigInt(last) ||
      (range.first !== null && BigInt(cursor) < BigInt(range.first) - 1n);
    if (!resync) {
      const rows = this.ctx.storage.sql.exec<StoredEvent>(
        "SELECT * FROM events WHERE cursor>? AND (user_id IS NULL OR user_id=?) ORDER BY cursor",
        Number(cursor),
        connection.userId,
      );
      for (const row of rows)
        server.send(
          JSON.stringify({
            type: "event",
            cursor: String(row.cursor),
            event: JSON.parse(row.payload),
          }),
        );
    }
    server.send(
      JSON.stringify({
        type: "ready",
        cursor: last,
        resync,
        release,
        expiresAt: connection.expiresAt,
      }),
    );
    return new Response(null, { status: 101, webSocket: client });
  }

  /** 先持久化再广播，重复投递不生成新游标；过期或被撤销的会话不会收到事件。 */
  async publish(
    id: string,
    event: RealtimeOutboxMessage,
    userId: string | null,
    sessions: string[],
  ): Promise<void> {
    z.uuid().parse(id);
    const message = realtimeOutboxMessageSchema.parse(event);
    if (message.kind === "session-revoked") {
      if (!userId) throw new Error("SESSION_REVOCATION_USER_REQUIRED");
      this.closeRevokedSession(userId, message.resourceId);
      return;
    }
    const row = this.ctx.storage.transactionSync(() => {
      const inserted = this.ctx.storage.sql
        .exec<{ id: string }>(
          "INSERT OR IGNORE INTO receipts(id,created_at) VALUES (?,?) RETURNING id",
          id,
          Date.now(),
        )
        .toArray();
      if (!inserted.length)
        return this.ctx.storage.sql
          .exec<{ cursor: number }>("SELECT cursor FROM events WHERE event_id=?", id)
          .toArray()[0];
      const saved = this.ctx.storage.sql
        .exec<{ cursor: number }>(
          "INSERT INTO events(event_id,user_id,payload) VALUES (?,?,?) RETURNING cursor",
          id,
          userId,
          JSON.stringify(message),
        )
        .one();
      this.ctx.storage.sql.exec("DELETE FROM events WHERE cursor<=?", saved.cursor - 1000);
      this.ctx.storage.sql.exec(
        "DELETE FROM receipts WHERE created_at<?",
        Date.now() - 30 * 86400000,
      );
      return saved;
    });
    if (!row) return;
    // 确认前进程中断可导致重复投递，重发同一游标，让未收到广播的连接也能恢复。
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = attachmentSchema.parse(socket.deserializeAttachment());
      if (
        attachment.expiresAt <= Date.now() ||
        (attachment.sessionId !== "public" && !sessions.includes(attachment.sessionId))
      ) {
        socket.close(4001, "会话已失效");
        continue;
      }
      if (userId && userId !== attachment.userId) continue;
      try {
        socket.send(JSON.stringify({ type: "event", cursor: String(row.cursor), event: message }));
      } catch {
        socket.close(1011, "连接已中断");
      }
    }
  }

  /** 关闭被替换的会话，重复投递和晚到的消息只会影响同一个会话编号。 */
  private closeRevokedSession(userId: string, sessionId: string) {
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM revoked_sessions WHERE expires_at<=?", now);
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO revoked_sessions (id,expires_at) VALUES (?,?)",
      sessionId,
      now + revokedSessionRetention,
    );
    for (const socket of this.ctx.getWebSockets(userId)) {
      const attachment = attachmentSchema.parse(socket.deserializeAttachment());
      if (attachment.sessionId !== sessionId || socket.readyState !== WebSocket.OPEN) continue;
      // 先发退出信号，页面无需等 WebSocket 关闭握手完成。
      socket.send(JSON.stringify({ type: "session-revoked" }));
      socket.close(sessionReplacedCloseCode, "会话已被其他设备替换");
    }
  }

  /** 响应对端的关闭帧，及时释放休眠 WebSocket。 */
  override webSocketClose(socket: WebSocket, code: number, reason: string) {
    if (code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code))
      socket.close(code, reason);
    else if (code !== 1006) socket.close();
  }

  /** 客户端只允许自动心跳；业务操作走带权限与 CSRF 校验的 API。 */
  override async webSocketMessage(socket: WebSocket, _message: string | ArrayBuffer) {
    socket.close(1008, "不支持的消息");
  }
}
