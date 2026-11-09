import type { CreateTaskInput } from "@lycoboai/contracts";

// Legacy asynchronous provider contract; the synchronous Vakv adapter is exported separately.
export interface GenerationProvider {
  readonly name: string;
  submit(
    input: CreateTaskInput,
    options: { signal: AbortSignal; providerIdempotencyKey: string },
  ): Promise<{ providerTaskId: string }>;
  poll(
    providerTaskId: string,
    options: { signal: AbortSignal },
  ): Promise<
    | { status: "pending" }
    | { status: "succeeded"; outputs: Array<{ temporaryUrl: string }> }
    | { status: "failed"; code: string; retryable: boolean }
  >;
}

export * from "./images/standalone-models";
export * from "./images/textile-generation";
export { readPlannerStream } from "./planning/planner-stream";
export { createPlannerWebReader, PlannerWebError, plannerUrls } from "./planning/planner-web";
export * from "./planning/variation-planner";
export * from "./providers/configured-provider";
export * from "./providers/provider-adapters";
export * from "./providers/provider-errors";
export * from "./providers/provider-secrets";
export * from "./providers/vakv-provider";
export * from "./videos/video-provider";
