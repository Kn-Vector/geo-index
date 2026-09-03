import fs from "node:fs";
import path from "node:path";
import type { Entity, EntityProfile, IndicatorDefinition } from "@geo-index/schema";
import { loadEntities, repoRoot } from "../catalog.ts";
import { formatNumber } from "./format.ts";

export type Comparison = {
  indicatorId: string;
  year: number;
  entityValue: number;
  regionName?: string;
  regionMedian?: number;
  regionN?: number;
  globalMedian?: number;
  globalN?: number;
  sentence: string;
};

type Peer = {
  entityId: string;
  tier: string;
  subregion?: string;
  region?: string;
  values: Map<string, { year: number; value: number }>;
};

const RATE_IDS = new Set([
  "gdp-per-capita",
  "gdp-per-capita-ppp",
  "gni-per-capita",
  "life-expectancy",
  "life-expectancy-male",
  "life-expectancy-female",
  "total-fertility-rate",
  "median-age",
  "population-density",
  "urban-population-pct",
  "age-65-plus-pct",
  "infant-mortality",
  "under-five-mortality",
  "forest-area-pct",
  "gdp-growth",
  "inflation-cpi",
  "unemployment",
  "hdi",
  "health-expenditure-pct-gdp",
  "measles-immunization",
  "ihdi",
  "gdi",
  "gii",
  "mpi",
  "literacy-rate-adult",
  "mean-years-schooling",
  "labor-force-participation",
  "co2-per-capita",
]);

let peers: Peer[] | undefined;
let entityMeta: Map<string, Entity> | undefined;

function loadPeers(): Peer[] {
  if (peers) return peers;
  const root = repoRoot();
  const dir = path.join(root, "data/generated/entities");
  entityMeta = new Map(loadEntities().map((e) => [e.id, e]));
  peers = [];
  if (!fs.existsSync(dir)) return peers;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const profile = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as EntityProfile;
    const entity = entityMeta.get(profile.entityId);
    const values = new Map<string, { year: number; value: number }>();
    for (const obs of profile.observations) {
      if (!RATE_IDS.has(obs.indicatorId)) continue;
      if (obs.value == null) continue;
      values.set(obs.indicatorId, { year: obs.period.year, value: obs.value });
    }
    peers.push({
      entityId: profile.entityId,
      tier: profile.tier,
      subregion: entity?.subregion?.name,
      region: entity?.region?.name,
      values,
    });
  }
  return peers;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid];
}

function relation(value: number, med: number): "above" | "below" | "near" {
  const denom = Math.abs(med) < 1e-9 ? 1 : Math.abs(med);
  const delta = (value - med) / denom;
  if (Math.abs(delta) < 0.03) return "near";
  return value > med ? "above" : "below";
}

export function comparisonFor(
  entity: Entity,
  indicator: IndicatorDefinition,
  year: number,
  value: number,
): Comparison | null {
  if (!RATE_IDS.has(indicator.id) || !indicator.comparable) return null;
  const all = loadPeers();
  const regionName = entity.subregion?.name ?? entity.region?.name;
  const regionKey = entity.subregion?.name ? "subregion" : "region";

  const sameYear = (p: Peer) => {
    const hit = p.values.get(indicator.id);
    return hit && hit.year === year ? hit.value : undefined;
  };

  const globalVals = all.filter((p) => p.tier === "core").map(sameYear).filter((v): v is number => v != null);
  const regionVals = regionName
    ? all
        .filter((p) => (regionKey === "subregion" ? p.subregion === regionName : p.region === regionName))
        .map(sameYear)
        .filter((v): v is number => v != null)
    : [];

  const globalMed = globalVals.length >= 10 ? median(globalVals) : undefined;
  const regionMed = regionVals.length >= 3 ? median(regionVals) : undefined;
  if (globalMed == null && regionMed == null) return null;

  const formatted = (n: number) => formatNumber(n, indicator.format);
  const bits: string[] = [];
  if (regionMed != null && regionName) {
    const rel = relation(value, regionMed);
    const phrase = rel === "near" ? "close to" : `${rel} the`;
    bits.push(
      `${phrase} ${regionName} median of ${formatted(regionMed)} (${regionVals.length} profiles with ${year} data)`,
    );
  }
  if (globalMed != null) {
    const rel = relation(value, globalMed);
    const phrase = rel === "near" ? "close to" : `${rel} the`;
    bits.push(
      `${phrase} median of ${formatted(globalMed)} among ${globalVals.length} core profiles with ${year} data`,
    );
  }
  if (!bits.length) return null;

  const sentence = `${entity.commonName}’s ${indicator.shortLabel.toLowerCase()} is ${bits.join(", and ")}. Unweighted medians of the same-year cohort; not a population-weighted world average.`;

  return {
    indicatorId: indicator.id,
    year,
    entityValue: value,
    regionName,
    regionMedian: regionMed,
    regionN: regionMed != null ? regionVals.length : undefined,
    globalMedian: globalMed,
    globalN: globalMed != null ? globalVals.length : undefined,
    sentence,
  };
}

export function comparisonSentence(
  entity: Entity,
  indicator: IndicatorDefinition,
  year: number | undefined,
  value: number | undefined,
): string | undefined {
  if (year == null || value == null) return undefined;
  return comparisonFor(entity, indicator, year, value)?.sentence;
}

/** @internal test hook */
export function _resetCompareCache(): void {
  peers = undefined;
  entityMeta = undefined;
}
