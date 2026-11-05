import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useImageModels, useImageSession } from "./generation-client";
import { connectImageEvents } from "./image-event-connection";
import { pollImageTasks } from "./image-task-polling";

/** Keeps task, wallet and asset caches current: SSE when offered, otherwise task polling. */
export function useImageEvents() {
  const session = useImageSession();
  const models = useImageModels();
  const client = useQueryClient();
  const userId = session.data?.userId;
  const organizationId = session.data?.organizationId;
  const enabled = models.data?.eventsEnabled;
  const signedIn = session.isSuccess;
  useEffect(() => {
    if (!userId || !organizationId || !signedIn || !enabled || typeof EventSource === "undefined")
      return;
    return connectImageEvents(client);
  }, [client, userId, organizationId, enabled, signedIn]);
  useEffect(() => {
    if (!userId || !organizationId || !signedIn || enabled === undefined) return;
    return pollImageTasks(client, enabled);
  }, [client, userId, organizationId, enabled, signedIn]);
}
