import { type ImageResolution, publicImageResolutions } from "@lycoboai/contracts";

export const specRatios = ["1:1", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3", "21:9"] as const;
export type Spec = { ratio: string; resolution: ImageResolution };

const specKey = "lycobo:commerce:spec";
const specTtl = 30 * 60 * 1000;

/** 未登录时记住本次 Create 规格，登录返回后继续同一次选择。 */
export function rememberSpec(spec: Spec) {
  try {
    sessionStorage.setItem(specKey, JSON.stringify({ ...spec, at: Date.now() }));
  } catch {
    // 隐私模式禁用存储时只保留登录门禁，不阻断流程。
  }
}

/** 读取仍有效且在当前能力范围内的待用规格；读取本身不删除。 */
export function readSpec(): Spec | null {
  try {
    const raw = sessionStorage.getItem(specKey);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    if (!("ratio" in saved) || !("resolution" in saved) || !("at" in saved)) return null;
    if (typeof saved.at !== "number" || Date.now() - saved.at > specTtl) return null;
    const ratio = specRatios.find((item) => item === saved.ratio);
    const resolution = publicImageResolutions.find((item) => item === saved.resolution);
    return ratio && resolution ? { ratio, resolution } : null;
  } catch {
    return null;
  }
}

/** 清除已应用或已失效的待用规格。 */
export function clearSpec() {
  try {
    sessionStorage.removeItem(specKey);
  } catch {
    // 存储不可用时没有待用规格需要清理。
  }
}

/** 取出并清除待用规格；只有真正应用或确认覆盖时才调用。 */
export function takeSpec() {
  const spec = readSpec();
  if (spec) clearSpec();
  return spec;
}
