import createRive from "@rive-app/canvas-advanced";
import wasmUrl from "@rive-app/canvas-advanced/rive.wasm?url";

async function loadBytes(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("LANDING_BRAND_UNAVAILABLE");
  return response.arrayBuffer();
}

/** 加载自托管 Rive 文件，按指定进度绘制一帧，不启动持续播放循环。 */
export async function createLandingBrandRenderer(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const [wasmBinary, bytes] = await Promise.all([
    loadBytes(wasmUrl, boundedSignal),
    loadBytes("/brand/lycobo-navigation.riv", boundedSignal),
  ]);
  boundedSignal.throwIfAborted();
  const runtime = await createRive({ wasmBinary, locateFile: () => wasmUrl });
  boundedSignal.throwIfAborted();
  const file = await runtime.load(new Uint8Array(bytes), undefined, false);
  if (boundedSignal.aborted) {
    file.unref();
    boundedSignal.throwIfAborted();
  }
  const artboard = file.defaultArtboard();
  const timeline = artboard.animationByName("wordmark-to-focus");
  const animation = new runtime.LinearAnimationInstance(timeline, artboard);
  const renderer = runtime.makeRenderer(canvas);
  let disposed = false;

  return {
    draw(progress: number, width: number, height: number) {
      if (disposed) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      animation.time = Math.max(0, Math.min(1, progress));
      animation.apply(1);
      artboard.advance(0);
      renderer.clear();
      renderer.save();
      renderer.align(
        runtime.Fit.contain,
        runtime.Alignment.center,
        {
          minX: 0,
          minY: 0,
          maxX: pixelWidth,
          maxY: pixelHeight,
        },
        artboard.bounds,
      );
      artboard.draw(renderer);
      renderer.restore();
      runtime.resolveAnimationFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      animation.delete();
      artboard.delete();
      renderer.delete();
      file.unref();
    },
  };
}
