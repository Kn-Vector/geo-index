import fs from "node:fs";
import path from "node:path";
import type { Entity, IndicatorDefinition, Observation } from "@geo-index/schema";
import { streamCsvFile } from "../lib/csv.ts";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { RAW_UNESCO, UNESCO_EXTRACTED } from "../lib/paths.ts";
import { observationFromSeries, pushPoint, type EntitySourceBag, type GenericFetchMeta } from "../lib/series.ts";

function uisMap(indicators: IndicatorDefinition[]): Map<string, IndicatorDefinition[]> {
  const map = new Map<string, IndicatorDefinition[]>();
  const add = (code: string, ind: IndicatorDefinition) => {
    const list = map.get(code) ?? [];
    list.push(ind);
    map.set(code, list);
  };
  for (const ind of indicators) {
    if (ind.preferredSource === "unesco-uis") add(ind.sourceIndicatorId, ind);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === "unesco-uis") add(fb.sourceIndicatorId, ind);
    }
  }
  return map;
}

function isoField(rec: Record<string, string>): string | undefined {
  return rec.COUNTRY_ID ?? rec.country_id ?? rec.geoUnit ?? rec.GEO_UNIT ?? rec.ISO3;
}

function indicatorField(rec: Record<string, string>): string | undefined {
  return rec.INDICATOR_ID ?? rec.indicator_id ?? rec.indicatorId ?? rec.INDICATOR;
}

function yearField(rec: Record<string, string>): number | null {
  const raw = rec.YEAR ?? rec.year ?? rec.TIME_PERIOD;
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(n) ? n : null;
}

function valueField(rec: Record<string, string>): number | null {
  return parseNumericCell(rec.VALUE ?? rec.value ?? rec.OBS_VALUE);
}

export async function parseUis(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
): Promise<Map<string, EntitySourceBag>> {
  const byCode = uisMap(indicators);
  const out = new Map<string, EntitySourceBag>();
  const csvs = ["OPRI_DATA_NATIONAL.csv", "SDG_DATA_NATIONAL.csv"]
    .map((n) => path.join(UNESCO_EXTRACTED, n))
    .filter((p) => fs.existsSync(p));

  for (const csvPath of csvs) {
    await streamCsvFile(csvPath, (rec) => {
      const code = indicatorField(rec);
      if (!code) return;
      const defs = byCode.get(code);
      if (!defs) return;
      const year = yearField(rec);
      const value = valueField(rec);
      if (year == null || value == null) return;
      const entity = resolveEntity(index, { iso3: isoField(rec) });
      if (!entity) return;
      let bag = out.get(entity.id);
      if (!bag) {
        bag = new Map();
        out.set(entity.id, bag);
      }
      for (const def of defs) {
        pushPoint(bag, def.id, code, { year, value, status: "actual" });
      }
    });
  }

  const apiDir = path.join(RAW_UNESCO, "api");
  if (fs.existsSync(apiDir) && !csvs.length) {
    for (const name of fs.readdirSync(apiDir).filter((n) => n.endsWith(".json"))) {
      const json = JSON.parse(fs.readFileSync(path.join(apiDir, name), "utf8")) as {
        records?: { indicatorId: string; geoUnit: string; year: number; value: number | null }[];
      };
      for (const rec of json.records ?? []) {
        if (rec.value == null || !Number.isFinite(rec.value)) continue;
        const defs = byCode.get(rec.indicatorId);
        if (!defs) continue;
        const entity = resolveEntity(index, { iso3: rec.geoUnit });
        if (!entity) continue;
        let bag = out.get(entity.id);
        if (!bag) {
          bag = new Map();
          out.set(entity.id, bag);
        }
        for (const def of defs) {
          pushPoint(bag, def.id, rec.indicatorId, { year: rec.year, value: rec.value, status: "actual" });
        }
      }
    }
  }
  return out;
}

export function uisObservation(
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
    extraNotes:
      "UNESCO UIS snapshot isolated under data/raw/unesco/ (CC BY-SA 3.0 IGO). Site MIT license is not ShareAlike.",
  });
}
