import { z } from "zod";

export const observationStatusSchema = z.enum(["actual", "estimate", "projection"]);

export type ObservationStatus = z.infer<typeof observationStatusSchema>;

export const observationPeriodSchema = z.object({
  year: z.number().int(),
  date: z.string().optional(),
});

export type ObservationPeriod = z.infer<typeof observationPeriodSchema>;

export const seriesPointSchema = z.object({
  period: z.string().min(1),
  value: z.number(),
  status: z.string().min(1),
});

/**
 * Canonical fact. `null` is stored as null and must never render as 0.
 * Zero is only valid when the source value is actually zero.
 */
export const observationSchema = z.object({
  indicatorId: z.string().min(1),
  entityId: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string().min(1),
  period: observationPeriodSchema,
  status: observationStatusSchema,
  sourceId: z.string().min(1),
  dataset: z.string().min(1),
  originalIndicatorId: z.string().min(1),
  retrievedAt: z.string().min(1),
  vintage: z.string().min(1),
  licenseId: z.string().min(1),
  notes: z.string().optional(),
  series: z.array(seriesPointSchema).optional(),
});

export type Observation = z.infer<typeof observationSchema>;
