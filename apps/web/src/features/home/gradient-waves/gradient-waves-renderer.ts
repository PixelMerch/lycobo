/** Gradient Waves 的轻量渲染器；改编自 React Bits（ed33ebe，MIT + Commons Clause）。 */
import { gradientWavesConfig as config } from "./gradient-waves-config";
import {
  GRADIENT_WAVES_FRAGMENT_SHADER,
  GRADIENT_WAVES_VERTEX_SHADER,
} from "./gradient-waves-shaders";

const QUALITY_STEPS = { low: 56, medium: 84 } as const;
type Quality = keyof typeof QUALITY_STEPS;

const INTRO_SECONDS = 2.6;

const UNIFORM_NAMES = [
  "uResolution",
  "uTime",
  "uClock",
  "uAmplitude",
  "uWaveScale",
  "uWaveRatio",
  "uSwell",
  "uTurbulence",
  "uHeight",
  "uTilt",
  "uZoom",
  "uFocus",
  "uFogDepth",
  "uBrightness",
  "uOpacity",
  "uGrain",
  "uHorizon",
  "uWave",
  "uCrest",
  "uSun",
  "uRelief",
  "uSheen",
  "uSteps",
  "uStride",
  "uIntro",
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];
type Uniforms = Map<UniformName, WebGLUniformLocation | null>;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, GRADIENT_WAVES_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, GRADIENT_WAVES_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function readUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): Uniforms {
  const uniforms: Uniforms = new Map();
  for (const name of UNIFORM_NAMES) {
    uniforms.set(name, gl.getUniformLocation(program, name));
  }
  return uniforms;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function qualityForViewport(): Quality {
  return window.matchMedia("(max-width: 767px)").matches
    ? config.qualityMobile
    : config.qualityDesktop;
}

/** 管理 GradientWaves 的 WebGL 生命周期、尺寸、可见性和减少动效回退。 */
class GradientWavesScene {
  private readonly gl: WebGL2RenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly program: WebGLProgram;
  private readonly uniforms: Uniforms;
  private readonly vao: WebGLVertexArrayObject | null;
  private readonly buffer: WebGLBuffer | null;
  private readonly reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private visible = false;
  private reduced = this.reducedQuery.matches;
  private frameId = 0;
  private last = 0;
  private clock = 0;
  private time = 0;
  private width = 1;
  private height = 1;
  private destroyed = false;

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Uniforms,
  ) {
    this.container = container;
    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.uniforms = uniforms;
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    this.bindGeometry();
    this.applyStaticUniforms();
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.intersectionObserver = new IntersectionObserver(this.onIntersect, {
      threshold: 0,
    });
    this.resizeObserver.observe(container);
    this.intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.reducedQuery.addEventListener("change", this.onReducedChange);
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.reducedQuery.removeEventListener("change", this.onReducedChange);
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }

  private bindGeometry() {
    const gl = this.gl;
    const bind = gl.useProgram.bind(gl);
    bind(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private applyStaticUniforms() {
    const gl = this.gl;
    const u = (name: UniformName) => this.uniforms.get(name) ?? null;
    const slope =
      config.amplitude *
      ((config.waveScale / 7) * (1 + config.swell / 20) +
        ((config.waveScale * config.waveRatio) / 3) * (1 + config.turbulence / 23));
    const sunAngle = (config.lightAngle * Math.PI) / 180;
    const elevation = 0.52;
    const bind = gl.useProgram.bind(gl);
    bind(this.program);
    gl.uniform1f(u("uAmplitude"), config.amplitude);
    gl.uniform1f(u("uWaveScale"), config.waveScale);
    gl.uniform1f(u("uWaveRatio"), config.waveRatio);
    gl.uniform1f(u("uSwell"), config.swell);
    gl.uniform1f(u("uTurbulence"), config.turbulence);
    gl.uniform1f(u("uHeight"), config.height);
    gl.uniform1f(u("uTilt"), (config.tilt * Math.PI) / 180);
    gl.uniform1f(u("uZoom"), config.zoom);
    gl.uniform2f(u("uFocus"), (0.5 - config.focusX) * 1.2, (0.5 - config.focusY) * 1.2);
    gl.uniform1f(u("uFogDepth"), config.fogDepth);
    gl.uniform1f(u("uBrightness"), config.brightness);
    gl.uniform1f(u("uOpacity"), config.opacity);
    gl.uniform1f(u("uGrain"), config.grain);
    gl.uniform1f(u("uRelief"), config.relief);
    gl.uniform1f(u("uSheen"), config.sheen);
    gl.uniform1f(u("uSteps"), QUALITY_STEPS[qualityForViewport()]);
    gl.uniform1f(u("uStride"), 0.9 / Math.max(1, slope / 1.5));
    gl.uniform3fv(u("uHorizon"), config.horizon);
    gl.uniform3fv(u("uWave"), config.wave);
    gl.uniform3fv(u("uCrest"), config.crest);
    gl.uniform3f(
      u("uSun"),
      Math.cos(elevation) * Math.cos(sunAngle),
      Math.cos(elevation) * Math.sin(sunAngle),
      Math.sin(elevation),
    );
  }

  private resize() {
    if (this.destroyed) return;
    const rect = this.container.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, config.dprLimit);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private render() {
    if (this.destroyed) return;
    const gl = this.gl;
    const u = (name: UniformName) => this.uniforms.get(name) ?? null;
    gl.viewport(0, 0, this.width, this.height);
    gl.uniform2f(u("uResolution"), this.width, this.height);
    gl.uniform1f(u("uTime"), this.time);
    gl.uniform1f(u("uClock"), this.clock);
    const progress = this.reduced ? 1 : Math.min(this.clock / INTRO_SECONDS, 1);
    const shown = Math.min(1, progress / 0.22);
    const crest = 160 * (3 / 160) ** easeInOut(Math.max(0, (progress - 0.1) / 0.9));
    const settle = Math.min(1, Math.max(0, (progress - 0.75) / 0.25));
    gl.uniform3f(
      u("uIntro"),
      shown * shown * (3 - 2 * shown),
      crest,
      1 - settle * settle * (3 - 2 * settle),
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private wake = () => {
    if (this.destroyed || this.frameId || !this.visible || document.hidden) return;
    if (this.reduced) {
      this.render();
      return;
    }
    this.last = 0;
    this.frameId = requestAnimationFrame(this.frame);
  };

  private frame = (now: number) => {
    this.frameId = 0;
    if (this.destroyed || !this.visible || document.hidden) return;
    const delta = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    this.clock += delta;
    this.time += delta * config.speed;
    this.resize();
    this.render();
    this.frameId = requestAnimationFrame(this.frame);
  };

  private onResize = () => {
    this.resize();
    this.render();
    this.wake();
  };

  private onIntersect = (entries: IntersectionObserverEntry[]) => {
    this.visible = entries.some((entry) => entry.isIntersecting);
    if (!this.visible) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      return;
    }
    this.wake();
  };

  private onVisibility = () => {
    if (!document.hidden) this.wake();
  };

  private onReducedChange = (event: MediaQueryListEvent) => {
    this.reduced = event.matches;
    if (this.reduced) {
      this.clock = Math.max(this.clock, INTRO_SECONDS);
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.render();
      return;
    }
    this.last = 0;
    this.wake();
  };
}

/** 在容器内挂载 GradientWaves；无 WebGL2 时保持 CSS 渐变后备背景。 */
export function mountGradientWaves(container: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.className = "gradient-waves-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    canvas.remove();
    return () => undefined;
  }
  const program = createProgram(gl);
  if (!program) {
    canvas.remove();
    return () => undefined;
  }
  const scene = new GradientWavesScene(container, canvas, gl, program, readUniforms(gl, program));
  return () => scene.destroy();
}
