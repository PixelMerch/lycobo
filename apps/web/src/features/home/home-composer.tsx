import { Button } from "@heroui/react";
import { IconLayoutCollage, IconPhotoPlus, IconPlus, IconSparkles } from "@tabler/icons-react";
import { type ReactNode, useRef } from "react";
import { useNavigate } from "react-router";
import { ReferencePrompt } from "../../components/reference-prompt/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { LoginRequiredInteraction } from "../auth/login-prompt";
import type { PromptOptimizeTool } from "../generation/references/prompt-optimizer-client";
import { ReferencePicker } from "../generation/references/reference-picker";
import { useStudioStore } from "../generation/studio-state";
import { homeMessages } from "./home-messages";
import { HomeModelSettings } from "./home-model-settings";
import type { HomeMode } from "./home-modes";
import { homeModeMessages } from "./home-modes-messages";
import { HomeTextileViews } from "./home-textile-views";
import {
  type HomePromptDraft,
  useCreateHomeDraft,
  useTextileHomeDraft,
  useVariationHomeDraft,
  useVideoHomeDraft,
} from "./use-home-mode-draft";

/** 按当前模式组合首页创作框：只编辑对应工具的草稿，进入工作区前不提交任何任务。 */
export function HomeComposer({ mode }: { mode: HomeMode }) {
  if (mode.id === "textile") return <TextileComposer mode={mode} />;
  if (mode.id === "variation") return <VariationComposer mode={mode} />;
  if (mode.id === "video") return <VideoComposer mode={mode} />;
  return <CreateComposer mode={mode} />;
}

function CreateComposer({ mode }: { mode: HomeMode }) {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useCreateHomeDraft();
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      body={
        <>
          <div className="home-references">
            <ReferencePicker
              compact
              model={model}
              references={draft.references}
              limit={mode.uploadLimit}
            />
          </div>
          <ComposerPrompt mode={mode} draft={draft} optimizeTool="create" />
        </>
      }
      settings={<HomeModelSettings />}
    />
  );
}

function VariationComposer({ mode }: { mode: HomeMode }) {
  const draft = useVariationHomeDraft();
  return <ControlledPromptComposer mode={mode} draft={draft} optimizeTool="variation" />;
}

function VideoComposer({ mode }: { mode: HomeMode }) {
  const draft = useVideoHomeDraft();
  return <ControlledPromptComposer mode={mode} draft={draft} optimizeTool="video" />;
}

function ControlledPromptComposer({
  mode,
  draft,
  optimizeTool,
}: {
  mode: HomeMode;
  draft: HomePromptDraft;
  optimizeTool: PromptOptimizeTool;
}) {
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      body={
        <>
          <div className="home-references">
            <ReferencePicker
              compact
              references={draft.references}
              prompt={draft.prompt}
              onChange={draft.setReferences}
              limit={mode.uploadLimit}
            />
          </div>
          <ComposerPrompt mode={mode} draft={draft} optimizeTool={optimizeTool} />
        </>
      }
    />
  );
}

/** 家纺裂变保留左侧两行上传列：两行打开同一个文件选择框，第一张图在工具里作为主图。 */
function TextileComposer({ mode }: { mode: HomeMode }) {
  const draft = useTextileHomeDraft();
  const t = useMessages(homeModeMessages).textileUpload;
  const openFiles = useRef<(() => void) | null>(null);
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      aside={
        <div className="home-upload">
          <ReferencePicker
            references={draft.references}
            prompt=""
            onChange={draft.setReferences}
            limit={mode.uploadLimit}
            addLabel={t.main}
            addIcon={draft.references.length ? IconPlus : IconLayoutCollage}
            openRef={openFiles}
          />
          <Button
            variant="ghost"
            className="home-upload-secondary"
            onPress={() => openFiles.current?.()}
          >
            <UiIcon icon={IconPhotoPlus} size="action" />
            {t.extra}
          </Button>
        </div>
      }
      body={<HomeTextileViews />}
    />
  );
}

function ComposerPrompt({
  mode,
  draft,
  optimizeTool,
}: {
  mode: HomeMode;
  draft: HomePromptDraft;
  optimizeTool: PromptOptimizeTool;
}) {
  return (
    <ReferencePrompt
      className="home-prompt"
      maxLength={5000}
      showCount
      autoGrow
      autoGrowMinHeight={82}
      isRequired
      value={draft.prompt}
      onChange={draft.setPrompt}
      onReferencesInsert={(images, prompt) => {
        // @ 引用素材也算上传图片，超过当前模式的张数上限时不写入草稿。
        if (draft.references.length + images.length > mode.uploadLimit) return;
        draft.setReferences([...draft.references, ...images], prompt);
      }}
      references={draft.references}
      maxReferences={mode.uploadLimit}
      placeholder={mode.placeholder}
      optimizeTool={optimizeTool}
    />
  );
}

/** 左侧上传列（只有家纺裂变）、描述与右下角操作；“开始创作”只进入对应工具，不提交付费任务。 */
function ComposerShell({
  mode,
  aside,
  body,
  settings,
  canStart,
}: {
  mode: HomeMode;
  aside?: ReactNode;
  body: ReactNode;
  settings?: ReactNode;
  canStart: boolean;
}) {
  const navigate = useNavigate();
  const t = useMessages(homeMessages);
  return (
    <LoginRequiredInteraction className="home-composer">
      {aside}
      <div className="home-composer-body">
        {body}
        <div className="home-composer-tools">
          {settings}
          <Button
            className="home-submit"
            data-active={canStart || undefined}
            isDisabled={!canStart}
            onPress={() => void navigate(mode.path)}
          >
            <UiIcon icon={IconSparkles} size="small" />
            {t.start}
          </Button>
        </div>
      </div>
    </LoginRequiredInteraction>
  );
}
