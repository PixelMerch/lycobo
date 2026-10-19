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

export * from "./vakv-provider";
