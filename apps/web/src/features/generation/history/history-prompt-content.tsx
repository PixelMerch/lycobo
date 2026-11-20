import { CollapsibleText } from "../../../components/collapsible-text";
import { CopyPromptButton } from "../../../components/copy-prompt-button";

/** 图片与视频历史共用可展开的正文与复制入口。 */
export function HistoryPromptContent({
  text,
  id,
  copyLabel,
}: {
  text: string;
  id?: string | undefined;
  copyLabel?: string | undefined;
}) {
  return (
    <>
      <CollapsibleText text={text} {...(id ? { id } : {})} className="generation-prompt" />
      <CopyPromptButton text={text} label={copyLabel} className="copy-prompt" />
    </>
  );
}
