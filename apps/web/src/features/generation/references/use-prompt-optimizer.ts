import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "../../../lib/toast";
import { useRequireLogin } from "../../auth/login-prompt";
import { refreshWithoutRealtime } from "../../realtime/availability";
import { hasPromptDescription } from "./prompt-description";
import {
  PromptOptimizeRejected,
  type PromptOptimizeTool,
  promptOptimizeFailure,
  requestPromptOptimization,
} from "./prompt-optimizer-client";

type Attempt = { original: string; key: string; tool: PromptOptimizeTool };

function optimizationKey(attempt: Attempt | null, original: string, tool: PromptOptimizeTool) {
  return attempt?.original === original && attempt.tool === tool
    ? attempt.key
    : crypto.randomUUID();
}

/** Streams a rewrite into the field. The user's text comes back on stop, failure or undo. */
export function usePromptOptimizer({
  value,
  onChange,
  maxLength,
  tool,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  tool: PromptOptimizeTool | undefined;
}) {
  const client = useQueryClient();
  const requireLogin = useRequireLogin();
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string>();
  const retry = useRef<Attempt | null>(null);
  const [revision, setRevision] = useState<{ original: string; optimized: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const attempt = retry.current;
    if (attempt && (attempt.original !== value || attempt.tool !== tool))
      controller.current?.abort();
  }, [tool, value]);
  async function start() {
    if (!tool || controller.current || !hasPromptDescription(value) || !requireLogin()) return;
    const abort = new AbortController();
    const original = value;
    let preview = "";
    const key = optimizationKey(retry.current, original, tool);
    retry.current = { original, tool, key };
    controller.current = abort;
    setRunning(true);
    setRevision(null);
    try {
      const text = await requestPromptOptimization({
        prompt: original,
        tool,
        signal: abort.signal,
        key,
        onText: (text) => {
          preview = (preview + text).slice(0, maxLength);
          if (!abort.signal.aborted) setPreview(preview);
        },
      });
      abort.signal.throwIfAborted();
      const optimized = text.slice(0, maxLength);
      if (!optimized) throw new Error("EMPTY");
      retry.current = null;
      onChange(optimized);
      setRevision({ original, optimized });
    } catch (error) {
      if (error instanceof PromptOptimizeRejected) retry.current = null;
      if (!abort.signal.aborted) toast.danger(promptOptimizeFailure(error));
    } finally {
      refreshWithoutRealtime(client, "wallet", "wallet-entries");
      setPreview(undefined);
      controller.current = null;
      setRunning(false);
    }
  }
  return {
    running,
    preview,
    canStart: !running && hasPromptDescription(value),
    // Undo only applies to the rewrite itself; the user's later edits are theirs to keep.
    canUndo: !running && revision?.optimized === value,
    start: () => void start(),
    stop: () => controller.current?.abort(),
    dismissUndo: () => setRevision(null),
    undo: () => {
      if (revision) onChange(revision.original);
      setRevision(null);
    },
  };
}
