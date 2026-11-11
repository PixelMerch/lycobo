import { Button } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";
import { UiIcon } from "./ui-icon";

/** 可展开的长文本：历史与图片详情共用溢出测量和同一个可访问的展开按钮。 */
export function CollapsibleText({
  text,
  id,
  className,
  textContainerClassName,
}: {
  text: string;
  id?: string;
  className: string;
  textContainerClassName?: string;
}) {
  const t = useMessages(componentsMessages);
  const generatedId = useId();
  const contentId = id ?? generatedId;
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const node = paragraph.current;
    if (!node || expanded || !text) return;
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [expanded, text]);
  const content = (
    <p
      id={contentId}
      ref={paragraph}
      className={`${className}${expanded ? "" : " prompt-collapsed"}`}
    >
      {text}
    </p>
  );
  return (
    <div className="collapsible-text">
      {textContainerClassName ? <div className={textContainerClassName}>{content}</div> : content}
      {(overflow || expanded) && (
        <Button
          variant="tertiary"
          className="prompt-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? t.collapse : t.expandAll}
          <UiIcon icon={IconChevronDown} size="small" />
        </Button>
      )}
    </div>
  );
}
