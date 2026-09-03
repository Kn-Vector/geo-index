import { z } from "zod";
import { entityClassificationSchema, publicationTierSchema } from "./entity.ts";
import { observationSchema } from "./observation.ts";

export const HEADLINE_INDICATOR_IDS = [
  "population",
  "gdp",
  "gdp-per-capita",
  "hdi",
  "life-expectancy",
  "land-area",
] as const;

export type HeadlineIndicatorId = (typeof HEADLINE_INDICATOR_IDS)[number];

export const sourceVintageSchema = z.object({
  sourceId: z.string().min(1),
  dataset: z.string().min(1),
  vintage: z.string().min(1),
  retrievedAt: z.string().min(1),
  url: z.string().min(1),
  sha256: z.string().optional(),
  licenseId: z.string().min(1),
  blocker: z.string().optional(),
});

export type SourceVintage = z.infer<typeof sourceVintageSchema>;

export const entityProfileSchema = z.object({
  entityId: z.string().min(1),
  commonName: z.string().min(1),
  isoAlpha2: z.string().length(2).optional(),
  isoAlpha3: z.string().length(3).optional(),
  m49: z.string().regex(/^\d{3}$/).optional(),
  classification: entityClassificationSchema,
  tier: publicationTierSchema,
  generatedAt: z.string().min(1),
  headlines: z.object({
    population: observationSchema.nullable(),
    gdp: observationSchema.nullable(),
    gdpPerCapita: observationSchema.nullable(),
    hdi: observationSchema.nullable(),
    lifeExpectancy: observationSchema.nullable(),
    area: observationSchema.nullable(),
  }),
  observations: z.array(observationSchema),
  alternates: z.array(observationSchema),
});

export type EntityProfile = z.infer<typeof entityProfileSchema>;

export const coverageFractionSchema = z.object({
  indicatorId: z.string().min(1),
  coreWithValue: z.number().int().nonnegative(),
  core: z.number().int().positive(),
  fraction: z.number().min(0).max(1),
});

export const coverageReportSchema = z.object({
  generatedAt: z.string().min(1),
  core: z.number().int().positive(),
  profiledAdditional: z.number().int().nonnegative(),
  byIndicator: z.array(coverageFractionSchema),
});

export type CoverageReport = z.infer<typeof coverageReportSchema>;

export const dataManifestSchema = z.object({
  generatedAt: z.string().min(1),
  asOfYear: z.number().int(),
  entityCount: z.number().int().nonnegative(),
  coreProfiles: z.number().int().nonnegative(),
  vintages: z.object({
    wpp: z.string().nullable(),
    wdi: z.string().nullable(),
    hdr: z.string().nullable(),
    uis: z.string().nullable(),
    ilo: z.string().nullable(),
    weo: z.string().nullable(),
    owid: z.string().nullable(),
    naturalEarth: z.string().nullable(),
  }),
  sources: z.array(sourceVintageSchema),
  indicators: z.array(z.string().min(1)),
  blockers: z.array(z.string().min(1)),
  joinKeys: z.array(z.string().min(1)),
});

export type DataManifest = z.infer<typeof dataManifestSchema>;
