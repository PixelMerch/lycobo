import { silkCompositeShader, silkFieldShader, silkVertexShader } from "./silk-shaders";

type Uniforms = Record<string, WebGLUniformLocation | null>;
type Program = { program: WebGLProgram; uniforms: Uniforms };
type Rgb = [number, number, number];

/** 一帧需要的全部输入，由动画状态算好后交给渲染器。 */
export type SilkFrame = {
  /** 褶皱流动的时间轴。 */
  time: number;
  /** 开场展开进度 0–1。 */
  unfold: number;
  /** 整体显现程度 0–1。 */
  presence: number;
  /** 指针位置（画布 0–1 坐标，y 向上）与影响强度。 */
  pointer: Rgb;
  drag: [number, number];
  /** 最多 4 圈涟漪，每圈为 x、y、半径、强度。 */
  waves: Float32Array;
  /** 光源方向 x、y 与指针带来的额外光泽。 */
  light: Rgb;
  color: Rgb;
  sheenColor: Rgb;
};

/** 首页使用的一套固定外观参数。 */
export type SilkLook = {
  scale: number;
  rotation: number;
  wave: number;
  ripple: number;
  sheen: number;
  depth: number;
  glow: number;
  noiseIntensity: number;
};

/** 丝绸渲染器：按容器尺寸调整画布，逐帧绘制，卸载时释放全部 GPU 资源。 */
export type SilkRenderer = {
  resize: (width: number, height: number, ratio: number) => void;
  render: (frame: SilkFrame) => void;
  dispose: () => void;
};

// 没有 GPU 加速时浏览器用 SwiftShader、llvmpipe 等软件渲染器，编译与绘制全屏着色器都会占满 CPU。
function isSoftwareRenderer(gl: WebGL2RenderingContext) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, fragmentSource: string): Program | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, silkVertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
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
  const uniforms: Uniforms = {};
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);
    if (info) uniforms[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

// 两个着色器共用的纹样参数：视口、外观、时间轴、指针和涟漪。
function setPattern(
  gl: WebGL2RenderingContext,
  uniforms: Uniforms,
  size: [number, number],
  look: SilkLook,
  frame: SilkFrame,
) {
  gl.uniform2f(uniforms.uView ?? null, size[0], size[1]);
  gl.uniform1f(uniforms.uScale ?? null, look.scale);
  gl.uniform1f(uniforms.uRotation ?? null, look.rotation);
  gl.uniform1f(uniforms.uTime ?? null, frame.time);
  gl.uniform1f(uniforms.uWave ?? null, look.wave);
  gl.uniform1f(uniforms.uRipple ?? null, look.ripple);
  gl.uniform1f(uniforms.uFold ?? null, 0.25 + 0.75 * frame.unfold);
  gl.uniform4f(
    uniforms.uPointer ?? null,
    frame.pointer[0],
    frame.pointer[1],
    frame.pointer[2],
    0.32,
  );
  gl.uniform2f(uniforms.uDrag ?? null, frame.drag[0], frame.drag[1]);
  gl.uniform4fv(uniforms.uWaves ?? null, frame.waves);
}

// 合成着色器独有的颜色、光照与柔光参数。
function setSurface(
  gl: WebGL2RenderingContext,
  uniforms: Uniforms,
  look: SilkLook,
  frame: SilkFrame,
  step: [number, number],
) {
  gl.uniform3fv(uniforms.uColor ?? null, frame.color);
  gl.uniform3fv(uniforms.uSheenColor ?? null, frame.sheenColor);
  gl.uniform1f(uniforms.uNoiseIntensity ?? null, look.noiseIntensity);
  gl.uniform1f(uniforms.uDepth ?? null, look.depth);
  gl.uniform1f(uniforms.uSheen ?? null, look.sheen);
  gl.uniform1f(uniforms.uGlow ?? null, look.glow);
  gl.uniform3fv(uniforms.uLight ?? null, frame.light);
  gl.uniform2f(uniforms.uStep ?? null, step[0], step[1]);
  gl.uniform1f(uniforms.uPresence ?? null, frame.presence);
  gl.uniform1i(uniforms.uBloom ?? null, 0);
}

// 柔光用四分之一分辨率的离屏纹理，尺寸变化时才重新分配。
function createBloomTarget(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const size = { width: 0, height: 0 };
  function fit(width: number, height: number) {
    if (size.width === width && size.height === height) return;
    size.width = width;
    size.height = height;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }
  return { texture, framebuffer, size, fit };
}

/** 在画布上创建 WebGL2 丝绸渲染器；不支持 WebGL2、没有 GPU 加速或着色器编译失败时返回 null，页面保留静态渐变。 */
export function createSilkRenderer(canvas: HTMLCanvasElement, look: SilkLook): SilkRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;
  if (isSoftwareRenderer(gl)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const field = link(gl, silkFieldShader);
  const composite = link(gl, silkCompositeShader);
  if (!field || !composite) return null;
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const bloom = createBloomTarget(gl);
  // WebGL 的 useProgram 名字以 use 开头，会被 React Hook 规则误认成 Hook，这里绑定成普通函数名。
  const switchProgram = gl.useProgram.bind(gl);
  let ratio = 1;

  const render = (frame: SilkFrame) => {
    gl.bindVertexArray(vao);
    if (look.glow > 0) {
      bloom.fit(
        Math.max(1, Math.round(canvas.width / 4)),
        Math.max(1, Math.round(canvas.height / 4)),
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom.framebuffer);
      gl.viewport(0, 0, bloom.size.width, bloom.size.height);
      switchProgram(field.program);
      setPattern(gl, field.uniforms, [bloom.size.width, bloom.size.height], look, frame);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    switchProgram(composite.program);
    setPattern(gl, composite.uniforms, [canvas.width, canvas.height], look, frame);
    setSurface(gl, composite.uniforms, look, frame, [ratio / canvas.width, ratio / canvas.height]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    render,
    resize(width, height, nextRatio) {
      ratio = nextRatio;
      canvas.width = Math.max(1, Math.round(width * nextRatio));
      canvas.height = Math.max(1, Math.round(height * nextRatio));
    },
    dispose() {
      gl.deleteTexture(bloom.texture);
      gl.deleteFramebuffer(bloom.framebuffer);
      gl.deleteProgram(field.program);
      gl.deleteProgram(composite.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
