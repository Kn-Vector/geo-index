import { z } from "zod";

export const indicatorTopicSchema = z.enum([
  "people",
  "economy",
  "development",
  "health",
  "education",
  "work",
  "technology",
  "infrastructure",
  "environment",
]);

export type IndicatorTopic = z.infer<typeof indicatorTopicSchema>;

export const indicatorFormatSchema = z.enum([
  "compact-integer",
  "1-decimal",
  "3-decimal",
  "percent",
  "usd",
  "intl-dollar",
]);

export type IndicatorFormat = z.infer<typeof indicatorFormatSchema>;

export const missingPolicySchema = z.enum([
  "em-dash",
  "no-comparable-data",
  "omit-section",
]);

export type MissingPolicy = z.infer<typeof missingPolicySchema>;

export const indicatorFallbackSchema = z.object({
  sourceId: z.string().min(1),
  sourceIndicatorId: z.string().min(1),
});

export const indicatorDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  unit: z.string().min(1),
  topics: z.array(indicatorTopicSchema).min(1),
  preferredSource: z.string().min(1),
  sourceIndicatorId: z.string().min(1),
  fallbacks: z.array(indicatorFallbackSchema).default([]),
  frequency: z.enum(["annual", "quarterly", "monthly", "irregular"]),
  comparable: z.boolean(),
  rankable: z.boolean(),
  projectionPossible: z.boolean(),
  format: indicatorFormatSchema,
  missingPolicy: missingPolicySchema,
  headline: z.boolean().optional(),
  coverageThreshold: z.number().min(0).max(1).optional(),
});

export type IndicatorDefinition = z.infer<typeof indicatorDefinitionSchema>;

export const indicatorCatalogSchema = z.object({
  version: z.number().int().positive(),
  topics: z.array(indicatorTopicSchema),
  indicators: z.array(indicatorDefinitionSchema),
});

export type IndicatorCatalog = z.infer<typeof indicatorCatalogSchema>;

export const precedenceRuleSchema = z.object({
  indicatorId: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});

export const precedenceTableSchema = z.object({
  version: z.number().int().positive(),
  rules: z.array(precedenceRuleSchema),
});

export type PrecedenceTable = z.infer<typeof precedenceTableSchema>;
