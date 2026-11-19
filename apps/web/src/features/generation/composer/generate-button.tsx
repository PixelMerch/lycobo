import { Button, Spinner } from "@heroui/react";
import { IconSparkle } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";

/**
 * 电商工作区各功能共用的生成按钮（用户 2026-11-11 要求四个功能点击后的反馈一致）：点击后立刻进入提交中，
 * 保持主题色底，文字前出现旋转加载图标，外圈以中性色提示处理中，请求结束前不再响应点击。
 * 提交成功使用共用的“任务已提交”提示，积分星芒随按钮文字着色。
 */
export function GenerateButton({
  label,
  submitting,
  isDisabled,
  submittingLabel,
  cost,
  costDescription,
  describedBy,
  onPress,
}: {
  label: string;
  submitting: boolean;
  /** 还不能提交（缺少输入等）；提交中只显示进行中的样子，不显示成禁用的灰色。 */
  isDisabled: boolean;
  /** 加载图标给读屏用的说明。 */
  submittingLabel: string;
  /** 按钮里显示的积分；不显示时不传。 */
  cost?: number | undefined;
  costDescription?: string | undefined;
  describedBy?: string | undefined;
  onPress: () => void;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      className={`primary-action generation-submit${submitting ? " generation-pending" : ""}`}
      data-submitting={submitting || undefined}
      isPending={submitting}
      isDisabled={isDisabled && !submitting}
      aria-label={label}
      aria-description={costDescription}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      onPress={onPress}
    >
      {submitting && (
        <Spinner size="md" color="current" role="status" aria-label={submittingLabel} />
      )}
      {label}
      {cost !== undefined && (
        <span className="generate-credit-cost" aria-hidden="true">
          <UiIcon icon={IconSparkle} />
          <span>{cost}</span>
        </span>
      )}
    </Button>
  );
}
