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

/** Create 折叠行内的画幅、分辨率、输出尺寸与工作区交接。 */
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
    <div className="lp-specs">
      <div className="lp-specsPreview">
        <span className="lp-specsMark">{t.sampleMark}</span>
        <div className="lp-specsFrame" style={{ aspectRatio: ratio.replace(":", " / ") }}>
          {preview ? (
            <img alt={t.ratioPreview(ratio)} src={preview} />
          ) : (
            <span>{t.ratioPreview(ratio)}</span>
          )}
        </div>
      </div>

      <div className="lp-specsControls">
        <section className="lp-specsGroup">
          <h4>{t.ratio}</h4>
          <ToggleButtonGroup
            aria-label={t.ratio}
            className="lp-specsOptions"
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

        <section className="lp-specsGroup">
          <h4>{t.resolution}</h4>
          <ToggleButtonGroup
            aria-label={t.resolution}
            className="lp-specsOptions lp-specsResolutions"
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

        <p aria-live="polite" className="lp-specsSize">
          <span>{t.outputSize}</span>
          <strong>{t.dimensions(dimensions.width, dimensions.height)}</strong>
        </p>

        <div className="lp-specsAction">
          <Button onPress={create}>{t.action}</Button>
          <small>{t.actionHint}</small>
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
