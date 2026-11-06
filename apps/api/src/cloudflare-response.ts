/** 流式响应结束、失败或取消后再释放数据库连接，避免模型完成前关闭仓储。 */
export function closeAfterStream(response: Response, close: () => Promise<void>) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("STREAM_BODY_REQUIRED");
  let closing: Promise<void> | undefined;
  const closeOnce = () => {
    if (!closing) closing = close();
    return closing;
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          await closeOnce();
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        await closeOnce();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await closeOnce();
      }
    },
  });
  return new Response(body, response);
}
