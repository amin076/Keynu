import { z } from "zod";

const NonEmptyString = z.string().min(1);

export const KapRetryPolicySchema = z
  .object({
    attempt: z.number().int().positive().optional(),
    maximumAttempts: z.number().int().positive().optional(),
    retryable: z.boolean().optional(),
    retryAfterMs: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const KapChunkInfoSchema = z
  .object({
    chunkId: NonEmptyString,
    chunkIndex: z.number().int().nonnegative(),
    chunkCount: z.number().int().positive(),
    finalChunk: z.boolean(),
    checksum: NonEmptyString.optional(),
  })
  .passthrough();

export const KapEnvelopeMetadataSchema = z
  .object({
    correlationId: NonEmptyString.optional(),
    replyTo: NonEmptyString.optional(),
    traceId: NonEmptyString.optional(),
    missionId: NonEmptyString.optional(),
    workflowId: NonEmptyString.optional(),
    sequence: z.number().int().nonnegative().optional(),
    idempotencyKey: NonEmptyString.optional(),
    contentType: NonEmptyString.optional(),
    schema: NonEmptyString.optional(),
    deadlineAt: z.iso.datetime().optional(),
    retry: KapRetryPolicySchema.optional(),
    chunk: KapChunkInfoSchema.optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const BaseEnvelopeShape = {
  protocol: z.literal("KAP"),
  version: z.literal("1.0"),
  id: NonEmptyString,
  createdAt: z.iso.datetime().optional(),
  metadata: KapEnvelopeMetadataSchema.optional(),
};

export const KapJobSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("JOB"),
  payload: z
    .object({
      target: NonEmptyString,
      cwd: NonEmptyString.optional(),
    })
    .passthrough(),
});

export const KapReportSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("REPORT"),
  payload: z
    .object({
      jobId: NonEmptyString,
      status: z.enum(["COMPLETED", "FAILED", "BLOCKED", "CANCELLED"]),
      target: NonEmptyString.optional(),
      result: z.unknown().optional(),
      verification: z.unknown().optional(),
      certificate: z.unknown().optional(),
    })
    .passthrough(),
});

export const KapErrorSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("ERROR"),
  payload: z
    .object({
      jobId: NonEmptyString.optional(),
      status: z.literal("FAILED").optional(),
      error: NonEmptyString,
      errorCode: NonEmptyString.optional(),
      retryable: z.boolean().optional(),
      details: z.unknown().optional(),
    })
    .passthrough(),
});

export const KapMissionAckSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("MISSION_ACK"),
  payload: z
    .object({
      projectId: NonEmptyString,
      missionId: NonEmptyString,
      status: z.enum(["ACCEPTED", "REJECTED"]),
      understoodMilestone: NonEmptyString.optional(),
      message: z.string().optional(),
    })
    .passthrough(),
});

export const KapMissionBootstrapSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("MISSION_BOOTSTRAP"),
  payload: z
    .object({
      projectId: NonEmptyString,
      missionId: NonEmptyString,
      context: z.unknown(),
      validation: z.unknown(),
      protocolGuide: z.unknown(),
      requiredResponse: z.unknown(),
    })
    .passthrough(),
});

export const KapControlSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("CONTROL"),
  payload: z
    .object({
      action: z.enum([
        "START_JOB",
        "PAUSE_JOB",
        "RESUME_JOB",
        "CANCEL_JOB",
        "SWITCH_JOB",
        "RETRY_JOB",
        "REQUEST_USER_ACTION",
        "CONNECTION_LOST",
        "CONNECTION_RESTORED"
      ]),
      jobId: NonEmptyString.optional(),
      reason: z.string().optional(),
    })
    .passthrough(),
});

export const KapCapabilitiesSchema = z.object({
  ...BaseEnvelopeShape,
  type: z.literal("CAPABILITIES"),
  payload: z
    .object({
      protocolVersions: z.array(NonEmptyString),
      messageTypes: z.array(NonEmptyString),
      targets: z.array(NonEmptyString).optional(),
      extensions: z.array(NonEmptyString).optional(),
    })
    .passthrough(),
});

export const KapEnvelopeSchema = z.discriminatedUnion("type", [
  KapJobSchema,
  KapReportSchema,
  KapErrorSchema,
  KapMissionAckSchema,
  KapMissionBootstrapSchema,
  KapControlSchema,
  KapCapabilitiesSchema,
]);

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
    }),
  };
}
