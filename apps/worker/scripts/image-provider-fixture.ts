import { once } from "node:events";
import { createServer } from "node:http";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { z } from "zod";

export async function startImageProviderFixture(png: Buffer) {
  let calls = 0,
    mixed = 0;
  const server = createServer(async (req, res) => {
    calls++;
    let raw = "";
    for await (const bytes of req) raw += bytes.toString();
    const body = z
      .object({
        model: imageGenerationInputSchema.shape.model,
        prompt: imageGenerationInputSchema.shape.prompt,
      })
      .parse(JSON.parse(raw));
    if (body.prompt === "ambiguous") {
      res.writeHead(503);
      res.end("sensitive provider data");
      return;
    }
    if (body.prompt === "mixed" && mixed++ === 1) {
      res.writeHead(400);
      res.end("sensitive provider data");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json", "x-request-id": `fixture-${calls}` });
    res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture startup failed");
  return { server, address, calls: () => calls };
}
