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

export * from "./configured-provider";
export * from "./provider-adapters";
export * from "./provider-errors";
export * from "./provider-secrets";
export * from "./textile-generation";
export * from "./vakv-provider";
