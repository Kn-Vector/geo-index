import fs from "node:fs";
import path from "node:path";
import type { Entity, IndicatorDefinition, Observation } from "@geo-index/schema";
import { streamCsvFile } from "../lib/csv.ts";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { RAW_OWID } from "../lib/paths.ts";
import { observationFromSeries, pushPoint, type EntitySourceBag, type GenericFetchMeta } from "../lib/series.ts";

const GCP_NOTE =
  "Compiled by Our World in Data from the Global Carbon Project (original source). Not IEA-EDGAR.";

export async function parseOwid(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
): Promise<Map<string, EntitySourceBag>> {
  const csvPath = path.join(RAW_OWID, "owid-co2-data.csv");
  if (!fs.existsSync(csvPath)) return new Map();
  const byCol = new Map<string, IndicatorDefinition[]>();
  const add = (col: string, ind: IndicatorDefinition) => {
    const list = byCol.get(col) ?? [];
    list.push(ind);
    byCol.set(col, list);
  };
  for (const ind of indicators) {
    if (ind.preferredSource === "owid-co2") add(ind.sourceIndicatorId, ind);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === "owid-co2") add(fb.sourceIndicatorId, ind);
    }
  }

  const out = new Map<string, EntitySourceBag>();
  await streamCsvFile(csvPath, (rec) => {
    const entity = resolveEntity(index, { iso3: rec.iso_code });
    if (!entity) return;
    const year = Number.parseInt(rec.year ?? "", 10);
    if (!Number.isInteger(year)) return;
    let bag = out.get(entity.id);
    if (!bag) {
      bag = new Map();
      out.set(entity.id, bag);
    }
    for (const [col, defs] of byCol) {
      const value = parseNumericCell(rec[col]);
      if (value == null) continue;
      for (const def of defs) {
        pushPoint(bag, def.id, col, { year, value, status: "actual" }, GCP_NOTE);
      }
    }
  });
  return out;
}

export function owidObservation(
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
    extraNotes: GCP_NOTE,
  });
}
