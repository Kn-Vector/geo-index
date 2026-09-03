import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  entityCatalogSchema,
  indicatorCatalogSchema,
  coverageReportSchema,
  type Entity,
  type EntityCatalog,
  type EntityProfile,
  type IndicatorCatalog,
  type DataManifest,
  type CoverageReport,
} from "@geo-index/schema";
import { DEFAULT_THEME, type GeographyNote, type MediaAsset, type ThemeToken } from "./media.ts";
import { regionPath, slugify } from "./slug.ts";
import type { CompareEntity, CompareObservation, DirectoryRow } from "./site-types.ts";

export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "data/catalog/entities.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Cannot find data/catalog/entities.yaml from " + process.cwd());
}

let entityCatalog: EntityCatalog | undefined;

export function loadEntityCatalog(): EntityCatalog {
  if (entityCatalog) return entityCatalog;
  const file = path.join(repoRoot(), "data/catalog/entities.yaml");
  entityCatalog = entityCatalogSchema.parse(YAML.parse(fs.readFileSync(file, "utf8")));
  return entityCatalog;
}

export function loadEntities(): Entity[] {
  return loadEntityCatalog().entities;
}

export type GlobeIndexJson = {
  naturalEarthVersion: string;
  generatedAt: string;
  attribution: string;
  entities: Array<{
    id: string;
    slug: string;
    name: string;
    iso2?: string;
    iso3?: string;
    tier: string;
    classification: string;
    tiny: boolean;
    center: [number, number];
  }>;
};

export function loadGlobeIndex(): GlobeIndexJson | null {
  const root = repoRoot();
  const candidates = [
    path.join(root, "apps/web/public/geo/index.json"),
    path.join(root, "public/geo/index.json"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as GlobeIndexJson;
  }
  return null;
}

let indicatorCatalog: IndicatorCatalog | undefined;
let dataManifest: DataManifest | null | undefined;
const profileCache = new Map<string, EntityProfile | null>();

export function loadIndicators(): IndicatorCatalog {
  if (indicatorCatalog) return indicatorCatalog;
  const file = path.join(repoRoot(), "data/catalog/indicators.yaml");
  const raw = YAML.parse(fs.readFileSync(file, "utf8"));
  try {
    indicatorCatalog = indicatorCatalogSchema.parse(raw);
  } catch {
    indicatorCatalog = raw as IndicatorCatalog;
  }
  return indicatorCatalog;
}

export function loadDataManifest(): DataManifest | null {
  if (dataManifest !== undefined) return dataManifest;
  const file = path.join(repoRoot(), "data/generated/manifest.json");
  if (!fs.existsSync(file)) {
    dataManifest = null;
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as DataManifest;
  raw.vintages = {
    wpp: raw.vintages?.wpp ?? null,
    wdi: raw.vintages?.wdi ?? null,
    hdr: raw.vintages?.hdr ?? null,
    uis: raw.vintages?.uis ?? null,
    ilo: raw.vintages?.ilo ?? null,
    weo: raw.vintages?.weo ?? null,
    owid: raw.vintages?.owid ?? null,
    naturalEarth: raw.vintages?.naturalEarth ?? null,
  };
  dataManifest = raw;
  return dataManifest;
}

export function loadEntityProfile(entityId: string): EntityProfile | null {
  if (profileCache.has(entityId)) return profileCache.get(entityId)!;
  const file = path.join(repoRoot(), "data/generated/entities", `${entityId}.json`);
  const profile = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as EntityProfile)
    : null;
  profileCache.set(entityId, profile);
  return profile;
}

export { classificationLabel } from "./labels.ts";

let allProfiles: EntityProfile[] | undefined;
let themesById: Map<string, ThemeToken> | undefined;
let mediaById: Map<string, MediaAsset[]> | undefined;
let geographyById: Map<string, GeographyNote> | undefined;
let coverageReport: CoverageReport | null | undefined;

export function loadAllProfiles(): EntityProfile[] {
  if (allProfiles) return allProfiles;
  const dir = path.join(repoRoot(), "data/generated/entities");
  allProfiles = [];
  if (!fs.existsSync(dir)) return allProfiles;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    allProfiles.push(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as EntityProfile);
  }
  return allProfiles;
}

export function loadCoverage(): CoverageReport | null {
  if (coverageReport !== undefined) return coverageReport;
  const file = path.join(repoRoot(), "data/generated/coverage.json");
  if (!fs.existsSync(file)) {
    coverageReport = null;
    return null;
  }
  try {
    coverageReport = coverageReportSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    coverageReport = JSON.parse(fs.readFileSync(file, "utf8")) as CoverageReport;
  }
  return coverageReport;
}

export function loadTheme(entityId: string): ThemeToken {
  if (!themesById) {
    themesById = new Map();
    const file = path.join(repoRoot(), "data/generated/themes.json");
    if (fs.existsSync(file)) {
      const rows = JSON.parse(fs.readFileSync(file, "utf8")) as ThemeToken[];
      for (const row of rows) themesById.set(row.entityId, row);
    }
  }
  return themesById.get(entityId) ?? { ...DEFAULT_THEME, entityId };
}

export function loadMedia(entityId: string): MediaAsset[] {
  if (!mediaById) {
    mediaById = new Map();
    const file = path.join(repoRoot(), "data/generated/media.json");
    if (fs.existsSync(file)) {
      const rows = JSON.parse(fs.readFileSync(file, "utf8")) as MediaAsset[];
      for (const row of rows) {
        const list = mediaById.get(row.entityId) ?? [];
        list.push(row);
        mediaById.set(row.entityId, list);
      }
    }
  }
  return mediaById.get(entityId) ?? [];
}

export function loadGeographyNote(entityId: string): GeographyNote | undefined {
  if (!geographyById) {
    geographyById = new Map();
    const file = path.join(repoRoot(), "data/catalog/geography-notes.yaml");
    if (fs.existsSync(file)) {
      const raw = YAML.parse(fs.readFileSync(file, "utf8")) as { notes?: GeographyNote[] };
      for (const note of raw.notes ?? []) geographyById.set(note.entityId, note);
    }
  }
  return geographyById.get(entityId);
}

export type RegionRecord = {
  slug: string;
  m49: string;
  name: string;
  kind: "region" | "subregion" | "intermediate";
  entities: Entity[];
};

export function loadRegions(): RegionRecord[] {
  const map = new Map<string, RegionRecord>();
  const add = (kind: RegionRecord["kind"], region: { m49: string; name: string } | undefined, entity: Entity) => {
    if (!region) return;
    const slug = regionPath(region.name, region.m49);
    const key = `${kind}:${slug}`;
    let rec = map.get(key);
    if (!rec) {
      rec = { slug, m49: region.m49, name: region.name, kind, entities: [] };
      map.set(key, rec);
    }
    rec.entities.push(entity);
  };
  for (const entity of loadEntities()) {
    add("region", entity.region, entity);
    add("subregion", entity.subregion, entity);
    add("intermediate", entity.intermediateRegion, entity);
  }
  return [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((rec, _, all) => {
      const clash = all.filter((other) => other.slug === rec.slug).length > 1;
      return clash ? { ...rec, slug: `${rec.slug}-${rec.m49}` } : rec;
    });
}

export type { CompareEntity, CompareObservation, DirectoryRow } from "./site-types.ts";

export function loadDirectoryRows(): DirectoryRow[] {
  const profiles = new Map(loadAllProfiles().map((p) => [p.entityId, p]));
  return loadEntities().map((entity) => {
    const profile = profiles.get(entity.id);
    const byId = new Map((profile?.observations ?? []).map((o) => [o.indicatorId, o]));
    const pop = profile?.headlines.population ?? byId.get("population");
    const hdi = profile?.headlines.hdi ?? byId.get("hdi");
    const lex = profile?.headlines.lifeExpectancy ?? byId.get("life-expectancy");
    return {
      id: entity.id,
      name: entity.commonName,
      officialName: entity.officialName,
      iso2: entity.isoAlpha2,
      iso3: entity.isoAlpha3,
      classification: entity.classification,
      tier: entity.tier,
      region: entity.region?.name,
      subregion: entity.subregion?.name,
      regionSlug: entity.region ? regionPath(entity.region.name, entity.region.m49) : undefined,
      subregionSlug: entity.subregion ? regionPath(entity.subregion.name, entity.subregion.m49) : undefined,
      population: pop?.value ?? null,
      hdi: hdi?.value ?? null,
      lifeExpectancy: lex?.value ?? null,
    };
  });
}

export const COMPARE_INDICATOR_IDS = [
  "population",
  "gdp",
  "gdp-per-capita",
  "hdi",
  "life-expectancy",
  "land-area",
  "median-age",
  "total-fertility-rate",
  "gdp-growth",
  "unemployment",
  "ihdi",
  "mean-years-schooling",
  "labor-force-participation",
  "co2-per-capita",
] as const;

export function loadCompareIndex(): CompareEntity[] {
  const wanted = new Set<string>(COMPARE_INDICATOR_IDS);
  const entities = new Map(loadEntities().map((e) => [e.id, e]));
  return loadAllProfiles()
    .filter((p) => p.tier !== "index-only")
    .map((profile) => {
      const entity = entities.get(profile.entityId);
      const observations: Record<string, CompareObservation> = {};
      for (const obs of profile.observations) {
        if (!wanted.has(obs.indicatorId)) continue;
        observations[obs.indicatorId] = {
          value: obs.value,
          year: obs.period.year,
          status: obs.status,
          sourceId: obs.sourceId,
        };
      }
      return {
        id: profile.entityId,
        name: entity?.commonName ?? profile.commonName,
        iso2: entity?.isoAlpha2 ?? profile.isoAlpha2,
        iso3: entity?.isoAlpha3 ?? profile.isoAlpha3,
        classification: profile.classification,
        observations,
      };
    });
}

export { slugify, regionPath };
