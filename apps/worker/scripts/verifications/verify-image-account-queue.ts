import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { dispatchImageOutbox } from "@lycoboai/queue";

/** 在隔离库验证连续提交、跨任务并发、满载补位及不同账号互不占用名额。 */
export async function verifyImageAccountQueue(repository: ImageRepository) {
  const first = await repository.provision(
    crypto.randomUUID(),
    "queue-first",
    20 * imageUnitCredits,
  );
  const second = await repository.provision(
    crypto.randomUUID(),
    "queue-second",
    2 * imageUnitCredits,
  );
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "queue fixture",
    count: 1,
  });
  const submit = async (scope: typeof first) => {
    const { id } = await repository.create(scope, input, crypto.randomUUID(), imageUnitCredits);
    const job = await repository.get(scope, id);
    const itemId = job?.items[0]?.id;
    assert.ok(itemId);
    return itemId;
  };
  const ids = await Promise.all(Array.from({ length: 8 }, () => submit(first)));
  const other = await submit(second);
  const messages: string[] = [];
  const queue = {
    send: async (message: { itemId: string }) => {
      messages.push(message.itemId);
    },
  };
  assert.equal(await dispatchImageOutbox(repository, queue, first), 5);
  assert.equal(new Set(messages).size, 5);
  assert.ok(messages.every((id) => ids.includes(id)));

  // 模拟多消费者和部署前已入队的消息，数据库仍只能派发五次上游执行。
  const claims = await Promise.all(ids.map((id) => repository.claim(id, `queue:${id}`, 60000)));
  const running = claims.filter((claim) => claim !== null);
  assert.equal(running.length, 5);
  assert.equal(await dispatchImageOutbox(repository, queue, first), 0);
  assert.equal((await repository.wallet(first)).balance, 12 * imageUnitCredits);
  assert.equal(await dispatchImageOutbox(repository, queue, second), 1);
  assert.ok(await repository.claim(other, "queue:other", 60000));

  const finished = running[0];
  assert.ok(finished);
  assert.ok(await repository.finish(finished, { errorCode: "FIXTURE_DONE", unknown: false }));
  assert.equal(await dispatchImageOutbox(repository, queue, first), 1);
  const next = messages.at(-1);
  assert.ok(next && ids.includes(next) && running.every(({ itemId }) => itemId !== next));
  assert.ok(await repository.claim(next, "queue:next", 60000));
  assert.equal(await repository.claim(next, "queue:duplicate", 60000), null);
  assert.equal(await dispatchImageOutbox(repository, queue, first), 0);
  assert.equal((await repository.wallet(first)).balance, 13 * imageUnitCredits);
}
