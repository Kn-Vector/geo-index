import type { Entity, EntityProfile, IndicatorDefinition, Observation } from "@geo-index/schema";
import { loadAllProfiles, loadEntities } from "./catalog.ts";

export type RankRow = {
  rank: number;
  entityId: string;
  name: string;
  classification: string;
  value: number;
  year: number;
  status: string;
  sourceId: string;
};

export type RankTable = {
  indicatorId: string;
  year: number;
  cohort: number;
  rows: RankRow[];
  missing: { entityId: string; name: string; classification: string }[];
};

function latestYear(obs: Observation[]): number | undefined {
  const years = obs.map((o) => o.period.year).filter((y) => Number.isFinite(y));
  if (!years.length) return undefined;
  const counts = new Map<number, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
}

export function sameYearRanks(indicator: IndicatorDefinition, profiles?: EntityProfile[]): RankTable | null {
  if (!indicator.rankable) return null;
  const entities = new Map(loadEntities().map((e) => [e.id, e]));
  const all = profiles ?? loadAllProfiles();
  const hits: { entity: Entity; obs: Observation }[] = [];
  for (const profile of all) {
    if (profile.tier === "index-only") continue;
    const entity = entities.get(profile.entityId);
    if (!entity) continue;
    const obs = profile.observations.find((o) => o.indicatorId === indicator.id && o.value != null);
    if (obs && obs.value != null) hits.push({ entity, obs });
  }
  const year = latestYear(hits.map((h) => h.obs));
  if (year == null) return null;

  const same = hits
    .filter((h) => h.obs.period.year === year)
    .sort((a, b) => (b.obs.value as number) - (a.obs.value as number));

  const rows: RankRow[] = [];
  let lastValue: number | undefined;
  let lastRank = 0;
  same.forEach((hit, i) => {
    const value = hit.obs.value as number;
    const rank = lastValue === value ? lastRank : i + 1;
    lastValue = value;
    lastRank = rank;
    rows.push({
      rank,
      entityId: hit.entity.id,
      name: hit.entity.commonName,
      classification: hit.entity.classification,
      value,
      year,
      status: hit.obs.status,
      sourceId: hit.obs.sourceId,
    });
  });

  const present = new Set(rows.map((r) => r.entityId));
  const missing = loadEntities()
    .filter((e) => e.tier !== "index-only" && !present.has(e.id))
    .map((e) => ({ entityId: e.id, name: e.commonName, classification: e.classification }));

  return { indicatorId: indicator.id, year, cohort: rows.length, rows, missing };
}
