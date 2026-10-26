import { Button } from "@heroui/react";
import { useEffect, useId, useRef, useState } from "react";

/** History and image details share measured overflow and the same accessible toggle. */
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
    <>
      {textContainerClassName ? <div className={textContainerClassName}>{content}</div> : content}
      {(overflow || expanded) && (
        <Button
          variant="tertiary"
          className="prompt-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : "展开全部"}
        </Button>
      )}
    </>
  );
}
