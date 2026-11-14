import { Accordion } from "@heroui/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useMessages } from "../../../i18n/messages";
import { resultGroups, resultImageCount } from "./commerce-content";
import { KitSpecs } from "./kit-specs";
import { workflowMessages } from "./workflow-messages";

const groups = Object.fromEntries(resultGroups.map((group) => [group.id, group.images]));

function Chevron() {
  return (
    <Accordion.Indicator className="lp-kitChevron">
      <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
        <path
          d="m12.8 6.1-4.663 4.8L3.2 6.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </Accordion.Indicator>
  );
}

function FolderVisual({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: string;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="lp-folder"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <img alt="" src="/landing/folder-gradient.webp" />
      <div aria-hidden="true" className="lp-paperStack">
        {[0, 1, 2].map((sheet) => (
          <div key={sheet}>
            {[0, 1, 2, 3, 4].map((line) => (
              <i key={line} />
            ))}
          </div>
        ))}
      </div>
      <div className="lp-folderFront">
        <b>{title}</b>
        <span>{subtitle}</span>
        <p>
          <strong>{resultImageCount}</strong>
          {count}
        </p>
      </div>
    </motion.div>
  );
}

function KitRow({
  id,
  title,
  note,
  count,
  children,
}: {
  id: string;
  title: string;
  note: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Accordion.Item className="lp-kitRow" id={id}>
      <Accordion.Heading>
        <Accordion.Trigger className="lp-kitTrigger">
          <b>{title}</b>
          <span>{note}</span>
          <em>{count}</em>
          <Chevron />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel className="lp-kitContent">
        <Accordion.Body className="lp-kitBody">{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function ImageGrid({
  images,
  variant,
  alt,
}: {
  images: string[] | undefined;
  variant: "shots" | "details";
  alt: string;
}) {
  return (
    <div className={variant === "shots" ? "lp-kitThumbnails" : "lp-coverExamples"}>
      {(images ?? []).map((src) => (
        <i key={src}>
          <img alt={alt} loading="lazy" src={src} />
        </i>
      ))}
    </div>
  );
}

interface KitPanelProps {
  expandedKey: string;
  onExpandedChange: (key: string) => void;
  onHold?: () => void;
  onRelease?: () => void;
}

/** 工作流第三步：按用途分组的 12 张示例与 Create 规格选择。 */
export function KitPanel({ expandedKey, onExpandedChange, onHold, onRelease }: KitPanelProps) {
  const t = useMessages(workflowMessages).create;
  return (
    <div className="lp-createKit">
      <FolderVisual count={t.countUnit} subtitle={t.folderSubtitle} title={t.folderTitle} />

      <div className="lp-kitRowsWrap">
        <Accordion
          className="lp-kitRows"
          expandedKeys={[expandedKey]}
          hideSeparator
          onExpandedChange={(keys) => {
            const next = Array.from(keys)[0];
            if (next !== undefined) onExpandedChange(String(next));
          }}
          variant="surface"
        >
          <KitRow
            count={groups.hero?.length ?? 0}
            id="hero"
            note={t.rows.hero.note}
            title={t.rows.hero.title}
          >
            <ImageGrid alt={t.rows.hero.title} images={groups.hero} variant="shots" />
          </KitRow>
          <KitRow
            count={groups.lifestyle?.length ?? 0}
            id="lifestyle"
            note={t.rows.lifestyle.note}
            title={t.rows.lifestyle.title}
          >
            <ImageGrid alt={t.rows.lifestyle.title} images={groups.lifestyle} variant="shots" />
          </KitRow>
          <KitRow
            count={groups.details?.length ?? 0}
            id="details"
            note={t.rows.details.note}
            title={t.rows.details.title}
          >
            <ImageGrid alt={t.rows.details.title} images={groups.details} variant="details" />
          </KitRow>
          <KitRow
            count={groups.colors?.length ?? 0}
            id="colors"
            note={t.rows.colors.note}
            title={t.rows.colors.title}
          >
            <ImageGrid alt={t.rows.colors.title} images={groups.colors} variant="details" />
            <p className="lp-colorsNote">{t.colorsNote}</p>
          </KitRow>
          <KitRow
            count={groups.settings?.length ?? 0}
            id="settings"
            note={t.rows.settings.note}
            title={t.rows.settings.title}
          >
            <div
              onBlurCapture={onRelease}
              onFocusCapture={onHold}
              onPointerEnter={onHold}
              onPointerLeave={onRelease}
            >
              <KitSpecs />
            </div>
          </KitRow>
        </Accordion>
      </div>
    </div>
  );
}
