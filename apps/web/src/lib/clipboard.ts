import { toast } from "@heroui/react";

/** Copy text and report the outcome through the shared top toast. */
export async function copyToClipboard(value: string, success = "复制成功") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  } catch {
    toast.danger("复制失败，请手动选择复制");
  }
}
