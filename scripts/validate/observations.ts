import fs from "node:fs";
import path from "node:path";
import {
  coverageReportSchema,
  dataManifestSchema,
  entityProfileSchema,
  observationSchema,
  type Entity,
  type EntityProfile,
  type Observation,
} from "@geo-index/schema";
import { loadEntities, loadIndicators } from "../lib/catalogs.ts";
import { isImplausibleZero } from "../lib/values.ts";
import { COVERAGE_JSON, GENERATED_ENTITIES_DIR, MANIFEST_JSON } from "../lib/paths.ts";

const VALUED_REQUIRED = [
  "sourceId",
  "dataset",
  "originalIndicatorId",
  "retrievedAt",
  "vintage",
  "licenseId",
] as const;

export function validateObservation(obs: Observation): string[] {
  const errors: string[] = [];
  const parsed = observationSchema.safeParse(obs);
  if (!parsed.success) {
    errors.push(
      `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    return errors;
  }
  if (obs.value != null) {
    if (!Number.isFinite(obs.value)) {
      errors.push(`${obs.entityId} ${obs.indicatorId}: value is ${obs.value} (NaN/Infinity)`);
    }
    if (obs.period?.year == null) {
      errors.push(`${obs.entityId} ${obs.indicatorId}: valued statistic missing period`);
    }
    for (const key of VALUED_REQUIRED) {
      if (!obs[key]) errors.push(`${obs.entityId} ${obs.indicatorId}: valued statistic missing ${key}`);
    }
    if (isImplausibleZero(obs.indicatorId, obs.value)) {
      errors.push(`${obs.entityId} ${obs.indicatorId}: 0-for-null (implausible zero)`);
    }
  }
  if (obs.series) {
    for (const pt of obs.series) {
      if (!Number.isFinite(pt.value)) {
        errors.push(`${obs.entityId} ${obs.indicatorId} series ${pt.period}: ${pt.value}`);
      }
    }
  }
  return errors;
}

export function validateProfile(profile: EntityProfile, entity: Entity): string[] {
  const errors: string[] = [];
  const parsed = entityProfileSchema.safeParse(profile);
  if (!parsed.success) {
    errors.push(`${entity.id}: profile schema ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    return errors;
  }
  if (profile.entityId !== entity.id) errors.push(`${entity.id}: profile entityId mismatch`);
  if (entity.isoAlpha3 && profile.isoAlpha3 && profile.isoAlpha3 !== entity.isoAlpha3) {
    errors.push(`${entity.id}: profile isoAlpha3 drifted from catalog`);
  }
  for (const obs of [...profile.observations, ...profile.alternates]) {
    errors.push(...validateObservation(obs));
  }
  const headlines = Object.values(profile.headlines).filter((h): h is Observation => h != null);
  for (const obs of headlines) errors.push(...validateObservation(obs));

  const pop = profile.headlines.population ?? profile.observations.find((o) => o.indicatorId === "population");
  if (pop && pop.value != null && pop.sourceId !== "un-wpp") {
    const altWpp = profile.alternates.find((o) => o.indicatorId === "population" && o.sourceId === "un-wpp");
    if (altWpp) {
      errors.push(`${entity.id}: population primary is ${pop.sourceId} but WPP alternate exists (precedence)`);
    }
  }
  return errors;
}

export function validateGenerated(): string[] {
  const errors: string[] = [];
  const entities = loadEntities();
  const indicators = loadIndicators();
  const core = entities.entities.filter((e) => e.tier === "core");

  if (!fs.existsSync(GENERATED_ENTITIES_DIR)) {
    errors.push("data/generated/entities is missing — run pnpm data:normalize");
    return errors;
  }
  if (!fs.existsSync(MANIFEST_JSON)) errors.push("data/generated/manifest.json is missing");
  else {
    const manifestRaw = JSON.parse(fs.readFileSync(MANIFEST_JSON, "utf8"));
    const manifest = dataManifestSchema.safeParse(manifestRaw);
    if (!manifest.success) errors.push(`manifest schema: ${manifest.error.issues.map((i) => i.message).join("; ")}`);
  }
  if (fs.existsSync(COVERAGE_JSON)) {
    const cov = coverageReportSchema.safeParse(JSON.parse(fs.readFileSync(COVERAGE_JSON, "utf8")));
    if (!cov.success) errors.push(`coverage schema: ${cov.error.issues.map((i) => i.message).join("; ")}`);
  }

  const headline = indicators.indicators.filter((i) => i.headline);
  const expectedHeadlines = ["population", "gdp", "gdp-per-capita", "hdi", "life-expectancy", "land-area"];
  for (const id of expectedHeadlines) {
    if (!headline.some((i) => i.id === id)) errors.push(`indicators.yaml missing headline ${id}`);
  }

  for (const entity of core) {
    const file = path.join(GENERATED_ENTITIES_DIR, `${entity.id}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`missing core profile ${entity.id}`);
      continue;
    }
    const profile = JSON.parse(fs.readFileSync(file, "utf8")) as EntityProfile;
    errors.push(...validateProfile(profile, entity));
  }

  const extra = entities.entities.filter((e) => e.tier !== "core");
  for (const entity of extra) {
    const file = path.join(GENERATED_ENTITIES_DIR, `${entity.id}.json`);
    if (!fs.existsSync(file)) continue;
    const profile = JSON.parse(fs.readFileSync(file, "utf8")) as EntityProfile;
    errors.push(...validateProfile(profile, entity));
  }

  if (core.length !== 195) {
    errors.push(`core catalog is ${core.length}, expected 195`);
  }
  return errors;
}

export function main(): void {
  const errors = validateGenerated();
  if (errors.length) {
    console.error("Observation/profile validation failed:");
    for (const error of errors.slice(0, 80)) console.error(`  - ${error}`);
    if (errors.length > 80) console.error(`  … ${errors.length - 80} more`);
    process.exitCode = 1;
    return;
  }
  console.log("OK generated profiles + observations (no NaN/Infinity, no 0-for-null, core 195 present, provenance on valued stats)");
}
