import { z } from "zod";

/** Descriptive status — not a sovereignty claim. */
export const entityClassificationSchema = z.enum([
  "un-member",
  "un-observer",
  "associated-state",
  "dependency",
  "sar",
  "territory",
  "statistical-area",
  "special-status",
]);

export type EntityClassification = z.infer<typeof entityClassificationSchema>;

export const publicationTierSchema = z.enum([
  "core",
  "profiled-additional",
  "index-only",
]);

export type PublicationTier = z.infer<typeof publicationTierSchema>;

export const nativeNameSchema = z.object({
  value: z.string().min(1),
  /** BCP 47 language tag */
  language: z.string().min(2),
  script: z.string().min(1).optional(),
  source: z.enum(["wikidata", "natural-earth", "iso", "un-m49"]).optional(),
});

export type NativeName = z.infer<typeof nativeNameSchema>;

export const m49RegionSchema = z.object({
  m49: z.string().regex(/^\d{3}$/),
  name: z.string().min(1),
});

export type M49Region = z.infer<typeof m49RegionSchema>;

export const naturalEarthJoinSchema = z.object({
  /** Natural Earth ADM0_A3 — primary geometry join key */
  adm0A3: z.string().min(3).max(4).optional(),
  isoA3: z.string().min(3).max(3).optional(),
  isoA3Eh: z.string().min(3).max(3).optional(),
  name: z.string().optional(),
  admin: z.string().optional(),
  wikidataId: z.string().regex(/^Q\d+$/).optional(),
  tiny: z.boolean().optional(),
  type: z.string().optional(),
});

export type NaturalEarthJoin = z.infer<typeof naturalEarthJoinSchema>;

const iso2 = z.string().length(2).regex(/^[A-Z]{2}$/);
const iso3 = z.string().length(3).regex(/^[A-Z]{3}$/);
const m49 = z.string().regex(/^\d{3}$/);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2);

/**
 * One publishable place. Join statistics on `id`, ISO, M49, or ADM0_A3 —
 * never on English names.
 */
export const entitySchema = z.object({
  id: slug,
  commonName: z.string().min(1),
  officialName: z.string().min(1),
  /** UN statistical designation when it differs from the common name (e.g. Taiwan). */
  unDesignation: z.string().min(1).optional(),
  nativeNames: z.array(nativeNameSchema).optional(),
  isoAlpha2: iso2.optional(),
  isoAlpha3: iso3.optional(),
  m49: m49.optional(),
  region: m49RegionSchema.optional(),
  subregion: m49RegionSchema.optional(),
  intermediateRegion: m49RegionSchema.optional(),
  classification: entityClassificationSchema,
  tier: publicationTierSchema,
  wikidataId: z.string().regex(/^Q\d+$/).optional(),
  naturalEarth: naturalEarthJoinSchema.optional(),
  /** ISO alpha-3 of the administering / associated state, when applicable. */
  parentIsoAlpha3: iso3.optional(),
  notes: z.string().min(1).optional(),
  ldc: z.boolean().optional(),
  lldc: z.boolean().optional(),
  sids: z.boolean().optional(),
});

export type Entity = z.infer<typeof entitySchema>;

export const entityCatalogSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string().min(1),
  sources: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      url: z.string().url(),
      license: z.string(),
    }),
  ),
  entities: z.array(entitySchema).min(195),
});

export type EntityCatalog = z.infer<typeof entityCatalogSchema>;
