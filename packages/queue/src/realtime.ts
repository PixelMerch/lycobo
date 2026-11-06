import type { RealtimeEvent } from "@lycoboai/contracts";
import type { RealtimeRepository } from "@lycoboai/db";

export type RealtimePublisher = {
  getByName(channel: string): {
    publish(
      id: string,
      event: RealtimeEvent,
      userId: string | null,
      sessions: string[],
    ): Promise<void>;
  };
};

/** 从持久 outbox 投递；DO 确认后才标记，网络错误可由 Cron 安全重试。 */
export async function dispatchRealtime(
  repository: Pick<RealtimeRepository, "pending" | "sessions" | "delivered">,
  hubs: RealtimePublisher,
) {
  const pending = await repository.pending();
  const sessions = new Map<string, string[]>();
  for (const row of pending) {
    let active = sessions.get(row.channel);
    if (!active) {
      active = row.channel === "public" ? [] : await repository.sessions(row.channel);
      sessions.set(row.channel, active);
    }
    await hubs.getByName(row.channel).publish(row.id, row.event, row.userId, active);
    await repository.delivered(row.id);
  }
}
