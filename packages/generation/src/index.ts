import type { CreateTaskInput } from "@lycoboai/contracts";

// A contract only: provider integration must be explicit; never silently return demo images.
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
