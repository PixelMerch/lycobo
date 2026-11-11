import type { SilkFrame } from "./silk-renderer";

// 时间常量沿用 React Bits Silk：开场 2.2 秒展开，涟漪寿命 1.6 秒。
const introSeconds = 2.2;
const introRush = 1.6;
const waveLife = 1.6;
const defaultLight: [number, number] = [-0.55, 0.7];
const lightTilt = Math.hypot(defaultLight[0], defaultLight[1]);

/** 0–1 的 RGB 颜色。 */
export type Rgb = [number, number, number];
type Wave = { x: number; y: number; age: number };

/** 指针相对丝绸容器左上角的像素位置，以及是否落在容器内。 */
export type SilkPointer = { x: number; y: number; inside: boolean };

/** 每一帧的环境输入。 */
export type SilkInput = {
  width: number;
  height: number;
  pointer: SilkPointer;
  speed: number;
  interactionStrength: number;
  /** 只画静止画面（用户偏好减少动态效果）。 */
  still: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
// 按指数曲线靠近目标，rate 越大越快，与帧率无关。
const approach = (current: number, goal: number, rate: number, dt: number) =>
  current + (goal - current) * (1 - Math.exp(-dt * rate));
const approachRgb = (current: Rgb, goal: Rgb, rate: number, dt: number): Rgb => [
  approach(current[0], goal[0], rate, dt),
  approach(current[1], goal[1], rate, dt),
  approach(current[2], goal[2], rate, dt),
];
const rgbGap = (a: Rgb, b: Rgb) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * 丝绸的动画状态：褶皱流动、开场展开、指针跟随与光源偏转、涟漪，
 * 以及切换配色时的颜色过渡和短暂加速。只做计算，不碰 DOM 与 WebGL。
 */
export class SilkMotion {
  private flow = 0;
  private intro: number;
  private surge = 0;
  private touch = 0;
  private x = 0;
  private y = 0;
  private dragX = 0;
  private dragY = 0;
  private lightX = defaultLight[0];
  private lightY = defaultLight[1];
  private color: Rgb = [0, 0, 0];
  private sheen: Rgb = [1, 1, 1];
  private goalColor: Rgb = [0, 0, 0];
  private goalSheen: Rgb = [1, 1, 1];
  private hasPalette = false;
  private readonly waves: Wave[] = [];
  private readonly waveData = new Float32Array(16);

  constructor(animateIntro: boolean) {
    this.intro = animateIntro ? 0 : 1;
  }

  /** 换成新的配色；首次设置直接生效，之后在约一秒内平滑过渡。 */
  setPalette(color: Rgb, sheen: Rgb) {
    this.goalColor = color;
    this.goalSheen = sheen;
    if (this.hasPalette) return;
    this.color = color;
    this.sheen = sheen;
    this.hasPalette = true;
  }

  /** 在画布 0–1 坐标（y 向上）处荡开一圈涟漪，并让褶皱短暂加速。 */
  pulse(x: number, y: number) {
    this.waves.push({ x, y, age: 0 });
    if (this.waves.length > 4) this.waves.shift();
    this.surge = 1;
  }

  /** 推进一帧；返回 true 表示还需要继续逐帧绘制。 */
  step(dt: number, input: SilkInput) {
    const flowing = input.speed > 0 && !input.still;
    if (flowing) this.flow += dt * 0.1 * input.speed * (1 + this.surge * 2.5);
    this.surge *= Math.exp(-dt * 2.2);
    this.intro = input.still ? 1 : Math.min(1, this.intro + dt / introSeconds);
    const engaged = this.stepPointer(dt, input);
    const lightMoving = this.stepLight(dt, input, engaged);
    const colorMoving = this.stepPalette(dt, input.still);
    this.stepWaves(dt, input.still);
    const touchMoving = Math.abs((engaged ? 1 : 0) - this.touch) > 0.002;
    const settling = this.intro < 1 || this.waves.length > 0 || touchMoving;
    return flowing || settling || lightMoving || colorMoving;
  }

  /** 把当前状态整理成渲染器需要的一帧输入。 */
  frame(input: SilkInput): SilkFrame {
    const unfold = smoother(this.intro);
    this.waveData.fill(0);
    this.waves.slice(-4).forEach((wave, index) => {
      const strength = Math.exp(-wave.age / (waveLife * 0.45));
      this.waveData.set([wave.x, wave.y, wave.age * 0.6, strength], index * 4);
    });
    const touch = this.touch * input.interactionStrength;
    return {
      time: this.flow - introRush * (1 - unfold),
      unfold,
      presence: 1 - (1 - this.intro) ** 3,
      pointer: [this.x / input.width, 1 - this.y / input.height, touch],
      drag: [this.dragX, this.dragY],
      waves: this.waveData,
      light: [this.lightX, this.lightY, touch],
      color: this.color,
      sheenColor: this.sheen,
    };
  }

  // 指针进入容器时褶皱向指针弯折，移动越快拖拽越明显；离开后慢慢恢复。
  private stepPointer(dt: number, input: SilkInput) {
    const engaged = input.pointer.inside && !input.still;
    if (engaged && this.touch < 0.01) {
      this.x = input.pointer.x;
      this.y = input.pointer.y;
    }
    const prevX = this.x;
    const prevY = this.y;
    this.x = approach(this.x, input.pointer.x, 10, dt);
    this.y = approach(this.y, input.pointer.y, 10, dt);
    const velX = (this.x - prevX) / Math.max(dt, 0.001) / input.height;
    const velY = (this.y - prevY) / Math.max(dt, 0.001) / input.height;
    this.dragX = approach(this.dragX, clamp(velX * 0.03, -0.06, 0.06), 4, dt);
    this.dragY = approach(this.dragY, clamp(-velY * 0.03, -0.06, 0.06), 4, dt);
    this.touch = approach(this.touch, engaged ? 1 : 0, engaged ? 3.5 : 1.4, dt);
    return engaged;
  }

  // 指针在容器内时光源转向指针，离开后回到左上方的默认光。
  private stepLight(dt: number, input: SilkInput, engaged: boolean) {
    let goalX = defaultLight[0];
    let goalY = defaultLight[1];
    if (engaged) {
      const aimX = (input.pointer.x / input.width - 0.5) * (input.width / input.height);
      const aimY = 0.5 - input.pointer.y / input.height;
      const reach = Math.hypot(aimX, aimY);
      goalX = reach > 0.04 ? (aimX / reach) * lightTilt : this.lightX;
      goalY = reach > 0.04 ? (aimY / reach) * lightTilt : this.lightY;
    }
    this.lightX = approach(this.lightX, goalX, 3, dt);
    this.lightY = approach(this.lightY, goalY, 3, dt);
    return Math.abs(goalX - this.lightX) + Math.abs(goalY - this.lightY) > 0.001;
  }

  // 静止画面时直接换色，否则按指数曲线过渡。
  private stepPalette(dt: number, still: boolean) {
    if (still) {
      this.color = this.goalColor;
      this.sheen = this.goalSheen;
      return false;
    }
    this.color = approachRgb(this.color, this.goalColor, 3.2, dt);
    this.sheen = approachRgb(this.sheen, this.goalSheen, 3.2, dt);
    return rgbGap(this.color, this.goalColor) + rgbGap(this.sheen, this.goalSheen) > 0.004;
  }

  private stepWaves(dt: number, still: boolean) {
    for (let index = this.waves.length - 1; index >= 0; index--) {
      const wave = this.waves[index];
      if (!wave) continue;
      wave.age += dt;
      if (wave.age > waveLife * 2.5 || still) this.waves.splice(index, 1);
    }
  }
}
