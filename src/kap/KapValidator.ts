import { z } from "zod";

export const KapEnvelopeMetadataSchema = z
  .object({
    correlationId: z.string().min(1).optional(),
    replyTo: z.string().min(1).optional(),
    traceId: z.string().min(1).optional(),
    missionId: z.string().min(1).optional(),
    workflowId: z.string().min(1).optional(),
    sequence: z.number().int().nonnegative().optional(),
    idempotencyKey: z.string().min(1).optional(),
    contentType: z.string().min(1).optional(),
    schema: z.string().min(1).optional(),
    deadlineAt: z.iso.datetime().optional()
  })
  .passthrough();

export const KapEnvelopeSchema = z.object({
  protocol: z.literal("KAP"),
  version: z.string().min(1),
  type: z.string().min(1),
  id: z.string().min(1),
  createdAt: z.iso.datetime().optional(),
  payload: z.unknown().optional(),
  metadata: KapEnvelopeMetadataSchema.optional()
});

export type KapValidationResult =
  | { valid: true; value: z.infer<typeof KapEnvelopeSchema> }
  | { valid: false; issues: string[] };

export function validateKapEnvelope(value: unknown): KapValidationResult {
  const result = KapEnvelopeSchema.safeParse(value);

  if (result.success) {
    return { valid: true, value: result.data };
  }

  return {
    valid: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.join(".") || "envelope";
      return path + ": " + issue.message;
    })
  };
}
