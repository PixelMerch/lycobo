import { Button } from "@heroui/react";
import { IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { UiIcon } from "../../components/ui-icon";
import { useRequireLogin } from "../auth/login-prompt";
import type { HomeMode, HomeTemplate } from "./home-modes";
import { readHomePrompt, writeHomePrompt } from "./use-home-mode-draft";

/** 当前模式的描述模板：空白时直接填入，已有不同描述时先确认；不跳转、不提交任务。 */
export function HomeTemplates({ mode }: { mode: HomeMode }) {
  const requireLogin = useRequireLogin();
  const [replacing, setReplacing] = useState<HomeTemplate | null>(null);
  if (!mode.templates.length) return null;
  function apply(template: HomeTemplate) {
    if (!requireLogin()) return;
    const current = readHomePrompt(mode.id).trim();
    if (current && current !== template.prompt) {
      setReplacing(template);
      return;
    }
    writeHomePrompt(mode.id, template.prompt);
  }
  return (
    <section className="home-templates" aria-label="创作用途">
      {mode.templates.map((template) => (
        <Button
          key={template.name}
          variant="ghost"
          className="home-template"
          aria-label={template.name}
          onPress={() => apply(template)}
        >
          <UiIcon icon={template.icon} size="navigation" className="home-template-icon" />
          <span className="home-template-name">{template.name}</span>
          <span className="home-template-try" aria-hidden="true">
            试试看
            <UiIcon icon={IconChevronRight} size="small" />
          </span>
        </Button>
      ))}
      <ConfirmDialog
        isOpen={replacing !== null}
        title="替换当前描述？"
        content="当前已有创作描述。替换后，已添加的图片和参数会保留。"
        confirmLabel="替换"
        cancelLabel="保留当前内容"
        onCancel={() => setReplacing(null)}
        onConfirm={() => {
          if (replacing) writeHomePrompt(mode.id, replacing.prompt);
          setReplacing(null);
        }}
      />
    </section>
  );
}
