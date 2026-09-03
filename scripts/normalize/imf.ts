import fs from "node:fs";
import path from "node:path";
import type { Entity, IndicatorDefinition, Observation, ObservationStatus } from "@geo-index/schema";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { RAW_IMF } from "../lib/paths.ts";
import { observationFromSeries, pushPoint, type EntitySourceBag, type GenericFetchMeta } from "../lib/series.ts";

const BILLIONS = new Set(["NGDPD"]);

function scaleWeo(code: string, value: number): number {
  return BILLIONS.has(code) ? value * 1_000_000_000 : value;
}

function weoStatus(year: number, estimateLastYear: number): ObservationStatus {
  return year <= estimateLastYear ? "actual" : "projection";
}

function imfMap(indicators: IndicatorDefinition[]): Map<string, IndicatorDefinition[]> {
  const map = new Map<string, IndicatorDefinition[]>();
  const add = (code: string, ind: IndicatorDefinition) => {
    const list = map.get(code) ?? [];
    list.push(ind);
    map.set(code, list);
  };
  for (const ind of indicators) {
    if (ind.preferredSource === "imf-weo") add(ind.sourceIndicatorId, ind);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === "imf-weo") add(fb.sourceIndicatorId, ind);
    }
  }
  return map;
}

function ingestPoint(
  out: Map<string, EntitySourceBag>,
  index: EntityIndex,
  iso3: string,
  code: string,
  defs: IndicatorDefinition[],
  year: number,
  value: number,
  status: ObservationStatus,
): void {
  const entity = resolveEntity(index, { iso3 });
  if (!entity) return;
  let bag = out.get(entity.id);
  if (!bag) {
    bag = new Map();
    out.set(entity.id, bag);
  }
  const scaled = scaleWeo(code, value);
  for (const def of defs) {
    pushPoint(bag, def.id, code, { year, value: scaled, status });
  }
}

function parseDatamapper(
  index: EntityIndex,
  byCode: Map<string, IndicatorDefinition[]>,
  estimateLastYear: number,
  out: Map<string, EntitySourceBag>,
): void {
  const dir = path.join(RAW_IMF, "datamapper");
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const code = name.replace(/\.json$/i, "");
    const defs = byCode.get(code);
    if (!defs) continue;
    const json = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as {
      values?: Record<string, Record<string, Record<string, number>>>;
    };
    const byIso = json.values?.[code] ?? {};
    for (const [iso3, years] of Object.entries(byIso)) {
      for (const [yearStr, raw] of Object.entries(years)) {
        const year = Number.parseInt(yearStr, 10);
        if (!Number.isInteger(year) || raw == null || !Number.isFinite(raw)) continue;
        ingestPoint(out, index, iso3, code, defs, year, raw, weoStatus(year, estimateLastYear));
      }
    }
  }
}

export async function parseImf(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
  estimateLastYear: number,
): Promise<Map<string, EntitySourceBag>> {
  const byCode = imfMap(indicators);
  const out = new Map<string, EntitySourceBag>();
  const xlsx = fs.existsSync(RAW_IMF)
    ? fs.readdirSync(RAW_IMF).find((n) => n.toLowerCase().endsWith(".xlsx"))
    : undefined;
  if (xlsx) {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(RAW_IMF, xlsx));
      const sheet =
        wb.getWorksheet("Countries") ??
        wb.worksheets.find((s) => /country/i.test(s.name)) ??
        wb.worksheets[0];
      if (sheet) {
        const header: string[] = [];
        sheet.getRow(1).eachCell((cell, col) => {
          header[col] = String(cell.text ?? cell.value ?? "").trim();
        });
        const isoCol = header.findIndex((h) => /^iso$/i.test(h) || /iso.?3/i.test(h));
        const codeCol = header.findIndex((h) => /weo subject code/i.test(h) || h === "WEO Subject Code");
        const startCol = header.findIndex((h) => /estimates start after/i.test(h));
        const yearCols: { col: number; year: number }[] = [];
        header.forEach((h, col) => {
          if (/^\d{4}$/.test(h)) yearCols.push({ col, year: Number.parseInt(h, 10) });
        });
        if (isoCol > 0 && codeCol > 0) {
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const iso3 = String(row.getCell(isoCol).text ?? row.getCell(isoCol).value ?? "").trim();
            const code = String(row.getCell(codeCol).text ?? row.getCell(codeCol).value ?? "").trim();
            const defs = byCode.get(code);
            if (!defs || !iso3) return;
            const startAfter = startCol > 0 ? Number.parseInt(String(row.getCell(startCol).value ?? ""), 10) : NaN;
            const cutoff = Number.isInteger(startAfter) ? startAfter : estimateLastYear;
            for (const yc of yearCols) {
              const raw = row.getCell(yc.col).value;
              const value = parseNumericCell(raw == null ? "" : String(raw));
              if (value == null) continue;
              ingestPoint(out, index, iso3, code, defs, yc.year, value, weoStatus(yc.year, cutoff));
            }
          });
          return out;
        }
      }
    } catch (err) {
      console.warn(`IMF Excel parse failed, using DataMapper: ${err instanceof Error ? err.message : err}`);
    }
  }
  parseDatamapper(index, byCode, estimateLastYear, out);
  return out;
}

export function imfObservation(
  entity: Entity,
  indicator: IndicatorDefinition,
  series: { originalIndicatorId: string; points: { year: number; value: number; status: ObservationStatus }[]; notes?: string },
  asOfYear: number,
  meta: GenericFetchMeta,
): Observation | null {
  const extra =
    series.originalIndicatorId === "NGDPD"
      ? "WEO NGDPD is published in billions of US dollars and converted to US$ (* 1e9). Attribution: IMF World Economic Outlook. Raw Excel is not redistributed."
      : "IMF World Economic Outlook. Forecast years are marked projection. Raw Excel is not redistributed.";
  return observationFromSeries({ entityId: entity.id, indicator, series, asOfYear, meta, extraNotes: extra });
}
