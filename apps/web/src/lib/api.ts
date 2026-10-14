import { capabilitiesSchema } from "@lycoboai/contracts";
export async function fetchCapabilities(signal: AbortSignal) {
  const response = await fetch("/api/v1/system/capabilities", {
    signal,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("暂时无法连接服务，请稍后重试");
  return capabilitiesSchema.parse(await response.json());
}
