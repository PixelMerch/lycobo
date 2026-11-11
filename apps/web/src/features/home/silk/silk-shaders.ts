/*
 * 丝绸背景的着色器，改编自 React Bits Silk（DavidHDev/react-bits@ed33ebe4，MIT + Commons Clause，
 * 见 docs/third-party.md）。只保留深色模式：去掉了浅色模式、边缘渐隐和随机偏移，其余算法未改。
 */

/** 全屏三角形的顶点着色器。 */
export const silkVertexShader = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// 两个片元着色器共用的丝绸纹样：旋转、缩放后叠加正弦褶皱，指针与涟漪会让纹样局部弯折。
const silkPattern = `
uniform vec2 uView;
uniform float uScale;
uniform float uRotation;
uniform float uTime;
uniform float uWave;
uniform float uRipple;
uniform float uFold;
uniform vec4 uPointer;
uniform vec2 uDrag;
uniform vec4 uWaves[4];

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}

vec2 bend(vec2 uv) {
  vec2 aspect = vec2(uView.x / uView.y, 1.0);
  vec2 offset = (uv - uPointer.xy) * aspect;
  float touch = uPointer.z * exp(-dot(offset, offset) / (uPointer.w * uPointer.w));
  uv -= uDrag * touch;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    vec2 q = (uv - wave.xy) * aspect;
    float dist = length(q);
    float front = dist - wave.z;
    float ring = exp(-front * front * 60.0) * wave.w;
    uv += q / max(dist, 0.0001) / aspect * ring * 0.034 * sin(front * 34.0);
  }
  return uv;
}

float silk(vec2 vUv) {
  vec2 uv = rotateUvs(vUv * uScale, uRotation);
  vec2 tex = uv * uScale;
  float tOffset = uTime;
  tex.y += 0.03 * uWave * sin(8.0 * tex.x - tOffset);
  return 0.6 + 0.4 * uFold * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) + uRipple * sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
}
`;

/** 低分辨率高光场：只记录褶皱顶部的亮度，生成 mipmap 后作为柔光（bloom）采样。 */
export const silkFieldShader = `#version 300 es
precision highp float;
${silkPattern}
out vec4 outColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  float pattern = silk(bend(vUv));
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);
  outColor = vec4(pow(n, 6.0), 0.0, 0.0, 1.0);
}`;

/** 合成：按褶皱法线打光，叠加光泽、柔光与细颗粒，输出预乘透明度的颜色。 */
export const silkCompositeShader = `#version 300 es
precision highp float;
${silkPattern}
uniform sampler2D uBloom;
uniform vec3 uColor;
uniform vec3 uSheenColor;
uniform float uNoiseIntensity;
uniform float uDepth;
uniform float uSheen;
uniform float uGlow;
uniform vec3 uLight;
uniform vec2 uStep;
uniform float uPresence;
out vec4 outColor;

vec3 softClip(vec3 c) {
  vec3 over = max(c - 0.75, 0.0);
  return min(c, 0.75) + 0.25 * (1.0 - exp(-over * 4.0));
}

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  vec2 coord = bend(vUv);
  float pattern = silk(coord);
  float rnd = noise(gl_FragCoord.xy);
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);

  float gx = silk(coord + vec2(uStep.x, 0.0)) - pattern;
  float gy = silk(coord + vec2(0.0, uStep.y)) - pattern;
  vec3 normal = normalize(vec3(-gx * 26.0, -gy * 26.0, 1.0));
  vec3 toLight = normalize(vec3(uLight.xy, 0.85));
  float relief = 1.0 + (dot(normal, toLight) - toLight.z) * 1.8 * uDepth;
  vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
  float gloss = pow(max(dot(normal, halfway), 0.0), 48.0) * smoothstep(0.25, 0.85, n);
  float crest = pow(n, 5.0);
  float shine = (gloss * 0.85 + crest * 0.4) * uSheen * (1.0 + uLight.z * 0.6);

  float bloom = 0.0;
  if (uGlow > 0.0) {
    bloom += textureLod(uBloom, vUv, 1.0).r * 0.35;
    bloom += textureLod(uBloom, vUv, 2.0).r * 0.3;
    bloom += textureLod(uBloom, vUv, 3.0).r * 0.2;
    bloom += textureLod(uBloom, vUv, 4.0).r * 0.15;
  }

  float grain = rnd / 15.0 * uNoiseIntensity;
  float floorValue = mix(0.2, 0.03, uDepth);
  float curve = uDepth > 0.0 ? pow(n, 1.0 + 1.4 * uDepth) : n;
  float shade = uDepth > 0.0 ? floorValue + (1.0 - floorValue) * curve : pattern;
  vec3 tone = mix(uColor, pow(uColor, vec3(1.45)), (1.0 - n) * uDepth);
  vec3 lit = tone * shade * relief - vec3(grain);
  vec3 tint = mix(uColor, uSheenColor, 0.8);
  vec3 extra = tint * (shine + bloom * uGlow * 0.55);
  float blend = clamp((uSheen + uGlow) * 4.0, 0.0, 1.0);
  vec3 result = mix(clamp(lit, 0.0, 1.0), clamp(softClip(lit + extra), 0.0, 1.0), blend);

  outColor = vec4(result * uPresence, uPresence);
}`;
