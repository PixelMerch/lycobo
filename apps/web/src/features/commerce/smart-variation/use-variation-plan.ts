import { toast } from "@heroui/react";
import { variationCapabilitiesSchema } from "@lycoboai/contracts";
import {
  type QueryClient,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { currentMessages } from "../../../i18n/messages";
import {
  imageRequest,
  uploadImageReferences,
  useImageSession,
} from "../../generation/generation-client";
import { hasPromptDescription } from "../../generation/references/prompt-description";
import { readPlanResponse } from "./plan-stream";
import { preparePendingPlan } from "./prepare-pending-plan";
import { useSmartVariationDraft } from "./smart-variation-state";
import { variationMessages } from "./variation-messages";

type SessionScope = { organizationId: string; userId: string };
type VariationDraft = ReturnType<typeof useSmartVariationDraft.getState>;

async function analyzeVariation(
  client: QueryClient,
  scope: SessionScope,
  draft: VariationDraft,
  setStreamText: Dispatch<SetStateAction<string>>,
  setReadingWeb: (reading: boolean) => void,
) {
  const storageKey = `lycobo-variation-plan:${scope.organizationId}:${scope.userId}`;
  const pending = preparePendingPlan(storageKey, draft, () =>
    uploadImageReferences(client, scope, draft.references),
  );
  const response = await imageRequest(
    "variation-plans",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Idempotency-Key": pending.key,
      },
      body: JSON.stringify(pending.input),
    },
    90000,
  );
  let linkFailed = false;
  const plan = await readPlanResponse(
    response,
    (text) => setStreamText((current) => current + text),
    (stage) => {
      setReadingWeb(stage === "reading");
      linkFailed = stage === "link_failed";
    },
  );
  const t = currentMessages(variationMessages);
  if (plan.status === "running") throw new Error(t.stillRunning);
  sessionStorage.removeItem(storageKey);
  if (linkFailed) throw new Error(t.linkFailed);
  if (plan.status !== "ready")
    throw new Error(plan.status === "uncertain" ? t.uncertain : t.analysisFailed);
  return plan;
}

/** 并行准备参考图与文本计划，保留失败重试及草稿变更保护。 */
export function useVariationPlan() {
  const session = useImageSession();
  const client = useQueryClient();
  const draft = useSmartVariationDraft();
  const locked = useRef(false);
  const [readingWeb, setReadingWeb] = useState(false);
  const [streamText, setStreamText] = useState("");
  const mutationKey = ["variation-plan", session.data?.organizationId, session.data?.userId];
  const activeRequests = useIsMutating({ mutationKey });
  const capabilities = useQuery({
    queryKey: ["variation-capabilities"],
    enabled: session.isSuccess,
    retry: false,
    queryFn: async () =>
      variationCapabilitiesSchema.parse(
        await (await imageRequest("variation-plans/capabilities")).json(),
      ),
  });
  const mutation = useMutation({
    mutationKey,
    retry: false,
    onMutate: () => {
      setStreamText("");
      setReadingWeb(false);
      return { description: draft.description, references: draft.references };
    },
    mutationFn: async () => {
      if (!session.data) throw new Error(currentMessages(variationMessages).signInFirst);
      return analyzeVariation(client, session.data, draft, setStreamText, setReadingWeb);
    },
    onSuccess: (plan, _variables, snapshot) => {
      const current = useSmartVariationDraft.getState();
      if (
        current.description.trim() !== snapshot.description.trim() ||
        current.references.length !== snapshot.references.length ||
        current.references.some((image, index) => image.id !== snapshot.references[index]?.id) ||
        plan.description !== snapshot.description.trim()
      ) {
        toast.info(currentMessages(variationMessages).briefChanged);
        return;
      }
      current.update({
        planId: plan.id,
        description: plan.description,
        items: plan.items.map((item) => ({ ...item, selected: true })),
        references: plan.referenceAssetIds.length
          ? plan.referenceAssetIds.map((assetId, index) => ({
              id: assetId,
              assetId,
              src: snapshot.references[index]?.src ?? "",
              name:
                snapshot.references[index]?.name ??
                currentMessages(variationMessages).imageName(index + 1),
            }))
          : snapshot.references,
      });
    },
    onError: (error) => toast.danger(error.message),
    onSettled: () => {
      locked.current = false;
      setReadingWeb(false);
    },
  });
  const busy = mutation.isPending || activeRequests > 0;
  return {
    ...mutation,
    streamText,
    readingWeb,
    isPending: busy,
    mutate: (...args: Parameters<typeof mutation.mutate>) => {
      if (locked.current || busy) return;
      locked.current = true;
      mutation.mutate(...args);
    },
    enabled: capabilities.data?.enabled ?? false,
    canAnalyze:
      session.isSuccess &&
      !!capabilities.data?.enabled &&
      hasPromptDescription(draft.description) &&
      !busy,
  };
}
