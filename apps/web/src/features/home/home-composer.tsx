import { Button } from "@heroui/react";
import { IconPlus, IconSparkles } from "@tabler/icons-react";
import { type ReactNode, useRef } from "react";
import { useNavigate } from "react-router";
import { ReferencePrompt } from "../../components/reference-prompt/reference-prompt";
import { UiIcon } from "../../components/ui-icon";
import { LoginRequiredInteraction } from "../auth/login-prompt";
import type { PromptOptimizeTool } from "../generation/references/prompt-optimizer-client";
import { ReferencePicker } from "../generation/references/reference-picker";
import type { ReferenceImage } from "../generation/studio-state";
import { useStudioStore } from "../generation/studio-state";
import { HomeModelSettings } from "./home-model-settings";
import type { HomeMode } from "./home-modes";
import { HomeTextileViews } from "./home-textile-views";
import {
  type HomePromptDraft,
  useCreateHomeDraft,
  useTextileHomeDraft,
  useVariationHomeDraft,
  useVideoHomeDraft,
} from "./use-home-mode-draft";

type OpenFiles = { current: (() => void) | null };

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
  const openFiles = useRef<(() => void) | null>(null);
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      openFiles={openFiles}
      upload={
        <ReferencePicker
          model={model}
          references={draft.references}
          limit={mode.uploadLimit}
          addLabel={mode.upload[0].label}
          addIcon={draft.references.length ? IconPlus : mode.upload[0].icon}
          openRef={openFiles}
        />
      }
      body={<ComposerPrompt mode={mode} draft={draft} optimizeTool="create" />}
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
  const openFiles = useRef<(() => void) | null>(null);
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      openFiles={openFiles}
      upload={
        <ModeUpload
          mode={mode}
          references={draft.references}
          prompt={draft.prompt}
          onChange={draft.setReferences}
          openFiles={openFiles}
        />
      }
      body={<ComposerPrompt mode={mode} draft={draft} optimizeTool={optimizeTool} />}
    />
  );
}

function TextileComposer({ mode }: { mode: HomeMode }) {
  const draft = useTextileHomeDraft();
  const openFiles = useRef<(() => void) | null>(null);
  return (
    <ComposerShell
      mode={mode}
      canStart={draft.canStart}
      openFiles={openFiles}
      upload={
        <ModeUpload
          mode={mode}
          references={draft.references}
          prompt=""
          onChange={draft.setReferences}
          openFiles={openFiles}
        />
      }
      body={<HomeTextileViews />}
    />
  );
}

function ModeUpload({
  mode,
  references,
  prompt,
  onChange,
  openFiles,
}: {
  mode: HomeMode;
  references: ReferenceImage[];
  prompt: string;
  onChange: (images: ReferenceImage[], prompt: string) => void;
  openFiles: OpenFiles;
}) {
  return (
    <ReferencePicker
      references={references}
      prompt={prompt}
      onChange={onChange}
      limit={mode.uploadLimit}
      addLabel={mode.upload[0].label}
      addIcon={references.length ? IconPlus : mode.upload[0].icon}
      openRef={openFiles}
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

/** 左侧两行上传列、右侧描述与操作；“开始创作”只进入对应工具，不提交付费任务。 */
function ComposerShell({
  mode,
  upload,
  body,
  settings,
  canStart,
  openFiles,
}: {
  mode: HomeMode;
  upload: ReactNode;
  body: ReactNode;
  settings?: ReactNode;
  canStart: boolean;
  openFiles: OpenFiles;
}) {
  const navigate = useNavigate();
  const secondary = mode.upload[1];
  return (
    <LoginRequiredInteraction className="home-composer">
      <div className="home-upload">
        {upload}
        <Button
          variant="ghost"
          className="home-upload-secondary"
          onPress={() => openFiles.current?.()}
        >
          <UiIcon icon={secondary.icon} size="action" />
          {secondary.label}
        </Button>
      </div>
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
            开始创作
          </Button>
        </div>
      </div>
    </LoginRequiredInteraction>
  );
}
