import fs from "node:fs";
import path from "node:path";
import type { Entity, IndicatorDefinition, Observation } from "@geo-index/schema";
import { parseCsvLine, rowToRecord, stripBom } from "../lib/csv.ts";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { WDI_EXTRACTED } from "../lib/paths.ts";
import type { WdiFetchMeta } from "../fetch/wdi.ts";

export type WdiSeriesPoints = {
  indicator: IndicatorDefinition;
  originalIndicatorId: string;
  points: { year: number; value: number }[];
};

export type EntityWdi = Map<string, WdiSeriesPoints[]>;

function yearColumns(header: string[]): string[] {
  return header.filter((h) => /^\d{4}$/.test(h));
}

function readWdiCsv(file: string): { header: string[]; rows: Record<string, string>[] } {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\n/).map((l) => stripBom(l.replace(/\r$/, "")));
  let headerIndex = lines.findIndex((l) => l.startsWith('"Country Name"') || l.startsWith("Country Name"));
  if (headerIndex < 0) headerIndex = lines.findIndex((l) => l.includes("Country Code") && l.includes("Indicator Code"));
  if (headerIndex < 0) throw new Error(`Cannot find WDI header in ${file}`);
  const header = parseCsvLine(lines[headerIndex]!);
  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    rows.push(rowToRecord(header, parseCsvLine(line)));
  }
  return { header, rows };
}

export function parseWdiFiles(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
): Map<string, EntityWdi> {
  const byCode = new Map<string, { indicator: IndicatorDefinition; original: string }[]>();
  const add = (code: string, indicator: IndicatorDefinition) => {
    const list = byCode.get(code) ?? [];
    list.push({ indicator, original: code });
    byCode.set(code, list);
  };
  for (const ind of indicators) {
    if (ind.preferredSource === "world-bank-wdi") add(ind.sourceIndicatorId, ind);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === "world-bank-wdi") add(fb.sourceIndicatorId, ind);
    }
  }

  const out = new Map<string, EntityWdi>();
  for (const [code, defs] of byCode) {
    const csvPath = path.join(WDI_EXTRACTED, `${code}.csv`);
    if (!fs.existsSync(csvPath)) continue;
    const { header, rows } = readWdiCsv(csvPath);
    const years = yearColumns(header);
    for (const rec of rows) {
      const entity = resolveEntity(index, { iso3: rec["Country Code"] });
      if (!entity) continue;
      let bucket = out.get(entity.id);
      if (!bucket) {
        bucket = new Map();
        out.set(entity.id, bucket);
      }
      for (const def of defs) {
        const points: { year: number; value: number }[] = [];
        for (const y of years) {
          const year = Number.parseInt(y, 10);
          const value = parseNumericCell(rec[y]);
          if (value == null) continue;
          points.push({ year, value });
        }
        if (!points.length) continue;
        const list = bucket.get(def.indicator.id) ?? [];
        list.push({ indicator: def.indicator, originalIndicatorId: def.original, points });
        bucket.set(def.indicator.id, list);
      }
    }
  }
  return out;
}

export function wdiObservation(
  entity: Entity,
  series: WdiSeriesPoints,
  asOfYear: number,
  meta: WdiFetchMeta,
): Observation | null {
  const sorted = [...series.points].sort((a, b) => a.year - b.year);
  const eligible = sorted.filter((p) => p.year <= asOfYear);
  const latest = (eligible.length ? eligible : sorted).at(-1);
  if (!latest) return null;
  return {
    indicatorId: series.indicator.id,
    entityId: entity.id,
    value: latest.value,
    unit: series.indicator.unit,
    period: { year: latest.year },
    status: "actual",
    sourceId: "world-bank-wdi",
    dataset: meta.dataset,
    originalIndicatorId: series.originalIndicatorId,
    retrievedAt: meta.retrievedAt,
    vintage: meta.vintage,
    licenseId: meta.licenseId,
    series: sorted.map((p) => ({
      period: String(p.year),
      value: p.value,
      status: "actual",
    })),
  };
}
