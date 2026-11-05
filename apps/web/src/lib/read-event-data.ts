/** Read the named, single-line data records emitted by the generation endpoints. */
export async function* readEventData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onBytes?: (size: number) => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      onBytes?.(chunk.value.byteLength);
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trimEnd();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf("\n");
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) yield { event, data: line.slice(5) };
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
