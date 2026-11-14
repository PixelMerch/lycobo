import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import {
  type ImageResolution,
  imageOutputDimensions,
  publicImageResolutions,
} from "@lycoboai/contracts";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useRequireLogin } from "../../auth/login-prompt";
import { useStudioStore } from "../../generation/studio-state";
import { ratioPreviewImages } from "./commerce-content";
import { rememberSpec, type Spec, specRatios, takeSpec } from "./spec-intent";
import { workflowMessages } from "./workflow-messages";

/** 独立输出面板提供画幅、分辨率、输出尺寸与工作区交接。 */
export function KitSpecs() {
  const t = useMessages(workflowMessages).create;
  const session = useEnterpriseSession();
  const requireLogin = useRequireLogin();
  const navigate = useAppNavigate();
  const [ratio, setRatio] = useState<string>("1:1");
  const [resolution, setResolution] = useState<ImageResolution>("1.5K");
  const [pending, setPending] = useState<Spec | null>(null);
  const dimensions = imageOutputDimensions(ratio, resolution);
  const preview = ratioPreviewImages[ratio];

  const apply = useCallback(
    (spec: Spec) => {
      const { activeModel, updateDraft } = useStudioStore.getState();
      updateDraft(activeModel, spec);
      setPending(null);
      void navigate("/commerce/create");
    },
    [navigate],
  );

  const start = useCallback(
    (spec: Spec) => {
      const { activeModel, drafts } = useStudioStore.getState();
      const draft = drafts[activeModel];
      const hasContent = Boolean(draft?.prompt.trim()) || (draft?.references.length ?? 0) > 0;
      const settingsDiffer = draft?.ratio !== spec.ratio || draft?.resolution !== spec.resolution;
      if (hasContent && settingsDiffer) setPending(spec);
      else apply(spec);
    },
    [apply],
  );

  useEffect(() => {
    if (!session.data) return;
    const saved = takeSpec();
    if (saved) start(saved);
  }, [session.data, start]);

  function create() {
    const spec = { ratio, resolution };
    if (!requireLogin()) {
      rememberSpec(spec);
      return;
    }
    start(spec);
  }

  return (
    <div className="commerce-specs">
      <div className="commerce-specsPreview">
        <div
          className="commerce-specsFrame"
          style={{
            aspectRatio: ratio.replace(":", " / "),
            width: `min(100%, calc(var(--commerce-preview-edge) * ${Math.min(1, dimensions.width / dimensions.height)}))`,
          }}
        >
          {preview ? (
            <img alt={t.ratioPreview(ratio)} src={preview} />
          ) : (
            <img
              alt={t.ratioPreview(ratio)}
              src="/landing/commerce/p02-kitchen.webp"
              loading="lazy"
            />
          )}
        </div>
      </div>

      <div className="commerce-specsControls">
        <section className="commerce-specsGroup">
          <h4>{t.ratio}</h4>
          <ToggleButtonGroup
            aria-label={t.ratio}
            className="commerce-specsOptions"
            disallowEmptySelection
            isDetached
            selectedKeys={[ratio]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [next] = keys;
              if (next) setRatio(String(next));
            }}
          >
            {specRatios.map((value) => (
              <ToggleButton id={value} key={value}>
                {value}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </section>

        <section className="commerce-specsGroup">
          <h4>{t.resolution}</h4>
          <ToggleButtonGroup
            aria-label={t.resolution}
            className="commerce-specsOptions commerce-specsResolutions"
            disallowEmptySelection
            isDetached
            selectedKeys={[resolution]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [next] = keys;
              const value = publicImageResolutions.find((item) => item === next);
              if (value) setResolution(value);
            }}
          >
            {publicImageResolutions.map((value) => (
              <ToggleButton id={value} key={value}>
                {value}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </section>

        <p aria-live="polite" className="commerce-specsSize">
          <span>{t.outputSize}</span>
          <strong>{t.dimensions(dimensions.width, dimensions.height)}</strong>
        </p>

        <div className="commerce-specsAction">
          <Button onPress={create}>{t.action}</Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={pending !== null}
        title={t.replaceTitle}
        content={t.replaceContent}
        confirmLabel={t.replaceConfirm}
        cancelLabel={t.keepCurrent}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) apply(pending);
        }}
      />
    </div>
  );
}
