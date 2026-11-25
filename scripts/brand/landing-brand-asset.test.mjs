import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("loads the shipped Rive and reverses the C morph without leaving residual transforms", async () => {
  const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
  const { default: createRive } = await import(
    pathToFileURL(require.resolve("@rive-app/canvas-advanced")).href
  );
  const wasm = await readFile(require.resolve("@rive-app/canvas-advanced/rive.wasm"));
  const bytes = await readFile(
    new URL("../../apps/web/public/brand/lycobo-navigation.riv", import.meta.url),
  );
  const runtime = await createRive({ wasmBinary: Uint8Array.from(wasm).buffer });
  const file = await runtime.load(bytes, undefined, false);
  const artboard = file.defaultArtboard();
  const animation = new runtime.LinearAnimationInstance(
    artboard.animationByName("wordmark-to-focus"),
    artboard,
  );
  try {
    expect(artboard.animationCount()).toBe(1);
    const positions = [0, 0.5, 1, 0.5, 0].map((time) => {
      animation.time = time;
      animation.apply(1);
      artboard.advance(0);
      const node = artboard.node("c-to-focus");
      return { x: node.x, rotation: node.rotation };
    });
    expect(positions[0]).toEqual(positions[4]);
    expect(positions[1]).toEqual(positions[3]);
    expect(positions[0]?.x).toBeCloseTo(168);
    expect(positions[2]?.x).toBeCloseTo(320);
    expect(positions[2]?.rotation).toBeCloseTo(-Math.PI / 4);
  } finally {
    animation.delete();
    artboard.delete();
    file.unref();
  }
});
