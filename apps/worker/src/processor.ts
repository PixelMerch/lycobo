import { diagnosticJobSchema } from "@lycoboai/queue";
import { UnrecoverableError } from "bullmq";
export function processDiagnostic(name: string, data: unknown) {
  if (name !== "healthcheck") throw new UnrecoverableError("Unsupported diagnostic job");
  const parsed = diagnosticJobSchema.safeParse(data);
  if (!parsed.success) throw new UnrecoverableError("Invalid diagnostic job");
  return { runId: parsed.data.runId, status: "ok" as const };
}
