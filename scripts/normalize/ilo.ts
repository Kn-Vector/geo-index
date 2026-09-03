import fs from "node:fs";
import path from "node:path";
import type { Entity, IndicatorDefinition, Observation } from "@geo-index/schema";
import { streamCsvFile } from "../lib/csv.ts";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { RAW_ILO } from "../lib/paths.ts";
import { observationFromSeries, pushPoint, type EntitySourceBag, type GenericFetchMeta } from "../lib/series.ts";

const AGE_BY_INDICATOR: Record<string, string> = {
  unemployment: "AGE_YTHADULT_YGE15",
  "youth-unemployment": "AGE_YTHADULT_Y15-24",
  "labor-force-participation": "AGE_YTHADULT_YGE15",
  "employment-to-population": "AGE_YTHADULT_YGE15",
};

function tableId(code: string): string {
  return code.endsWith("_A") ? code : `${code}_A`;
}

function iloStatus(year: number, estimateLastYear: number): "estimate" | "projection" {
  return year <= estimateLastYear ? "estimate" : "projection";
}

export async function parseIlo(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
  estimateLastYear: number,
): Promise<Map<string, EntitySourceBag>> {
  const byFile = new Map<string, { indicator: IndicatorDefinition; original: string; age: string }[]>();
  const add = (code: string, indicator: IndicatorDefinition) => {
    const file = `${tableId(code)}.csv`;
    const age = AGE_BY_INDICATOR[indicator.id] ?? "AGE_YTHADULT_YGE15";
    const list = byFile.get(file) ?? [];
    list.push({ indicator, original: code, age });
    byFile.set(file, list);
  };
  for (const ind of indicators) {
    if (ind.preferredSource === "ilo-stat") add(ind.sourceIndicatorId, ind);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === "ilo-stat") add(fb.sourceIndicatorId, ind);
    }
  }

  const out = new Map<string, EntitySourceBag>();
  for (const [filename, defs] of byFile) {
    const csvPath = path.join(RAW_ILO, filename);
    if (!fs.existsSync(csvPath)) continue;
    const ages = new Set(defs.map((d) => d.age));
    await streamCsvFile(csvPath, (rec) => {
      if ((rec.sex ?? rec.SEX) !== "SEX_T") return;
      const age = rec.classif1 ?? rec.CLASSIF1 ?? rec.age;
      if (!age || !ages.has(age)) return;
      const year = Number.parseInt(rec.time ?? rec.TIME ?? rec.TIME_PERIOD ?? "", 10);
      const value = parseNumericCell(rec.obs_value ?? rec.OBS_VALUE);
      if (!Number.isInteger(year) || value == null) return;
      const entity = resolveEntity(index, { iso3: rec.ref_area ?? rec.REF_AREA });
      if (!entity) return;
      let bag = out.get(entity.id);
      if (!bag) {
        bag = new Map();
        out.set(entity.id, bag);
      }
      const status = iloStatus(year, estimateLastYear);
      for (const def of defs) {
        if (def.age !== age) continue;
        pushPoint(bag, def.indicator.id, def.original, { year, value, status });
      }
    });
  }
  return out;
}

export function iloObservation(
  entity: Entity,
  indicator: IndicatorDefinition,
  series: { originalIndicatorId: string; points: { year: number; value: number; status: "actual" | "estimate" | "projection" }[]; notes?: string },
  asOfYear: number,
  meta: GenericFetchMeta,
): Observation | null {
  return observationFromSeries({
    entityId: entity.id,
    indicator,
    series,
    asOfYear,
    meta,
    extraNotes: "ILO modelled estimates; sex=total. Years after the modelled-estimates cutoff are projections.",
  });
}
