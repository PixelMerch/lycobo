import { toast } from "@heroui/react";
import { pendingVariationPlanSchema, variationCapabilitiesSchema } from "@lycoboai/contracts";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  imageRequest,
  uploadImageReferences,
  useImageSession,
} from "../../generation/generation-client";
import { hasPromptDescription } from "../../generation/references/prompt-description";
import { readPlanResponse } from "./plan-stream";
import { useSmartVariationDraft } from "./smart-variation-state";

export function useVariationPlan() {
  const session = useImageSession();
  const client = useQueryClient();
  const draft = useSmartVariationDraft();
  const locked = useRef(false);
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
      return { description: draft.description, references: draft.references };
    },
    mutationFn: async () => {
      if (!session.data) throw new Error("请先登录");
      const storageKey = `lycobo-variation-plan:${session.data.organizationId}:${session.data.userId}`;
      let saved: unknown = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      } catch {
        sessionStorage.removeItem(storageKey);
      }
      let pending = pendingVariationPlanSchema.safeParse(saved);
      if (!pending.success) {
        const referenceAssetIds = await uploadImageReferences(
          client,
          session.data,
          draft.references,
        );
        const value = {
          key: crypto.randomUUID(),
          input: { description: draft.description, referenceAssetIds },
        };
        sessionStorage.setItem(storageKey, JSON.stringify(value));
        pending = pendingVariationPlanSchema.safeParse(value);
      }
      if (!pending.success) throw new Error("分析请求无法保存");
      const response = await imageRequest(
        "variation-plans",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Idempotency-Key": pending.data.key,
          },
          body: JSON.stringify(pending.data.input),
        },
        90000,
      );
      const plan = await readPlanResponse(response, (text) =>
        setStreamText((current) => current + text),
      );
      if (plan.status === "running") throw new Error("分析仍在处理，请稍后点击继续获取计划");
      sessionStorage.removeItem(storageKey);
      if (plan.status !== "ready")
        throw new Error(
          plan.status === "uncertain"
            ? "分析结果待确认，请稍后再试"
            : "分析未完成，请检查模型配置或稍后重试",
        );
      return plan;
    },
    onSuccess: (plan, _variables, snapshot) => {
      const current = useSmartVariationDraft.getState();
      if (
        current.description.trim() !== snapshot.description.trim() ||
        current.references.length !== snapshot.references.length ||
        current.references.some((image, index) => image.id !== snapshot.references[index]?.id) ||
        plan.description !== snapshot.description.trim()
      ) {
        toast.info("计划已保存，当前需求已变化，请重新分析");
        return;
      }
      current.update({
        planId: plan.id,
        description: plan.description,
        items: plan.items.map((item) => ({ ...item, selected: true })),
        references: plan.referenceAssetIds.map((assetId, index) => ({
          id: assetId,
          assetId,
          src: snapshot.references[index]?.src ?? "",
          name: snapshot.references[index]?.name ?? `图片${index + 1}`,
        })),
      });
    },
    onError: (error) => toast.danger(error.message),
    onSettled: () => {
      locked.current = false;
    },
  });
  const busy = mutation.isPending || activeRequests > 0;
  return {
    ...mutation,
    streamText,
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
