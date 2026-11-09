import { diagnosticJobSchema } from "@lycoboai/queue";
export function processDiagnostic(name: string, data: unknown) {
  if (name !== "healthcheck") throw new Error("Unsupported diagnostic job");
  const parsed = diagnosticJobSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid diagnostic job");
  return { runId: parsed.data.runId, status: "ok" as const };
}
