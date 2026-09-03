import fs from "node:fs";
import path from "node:path";
import type { IndicatorDefinition } from "@geo-index/schema";
import { parseCsvText } from "../lib/csv.ts";
import { type EntityIndex, resolveEntity } from "../lib/join.ts";
import { parseNumericCell } from "../lib/values.ts";
import { RAW_HDR } from "../lib/paths.ts";
import { observationFromSeries, pushPoint, type EntitySourceBag, type GenericFetchMeta } from "../lib/series.ts";
import type { Entity, Observation } from "@geo-index/schema";

const HDR_NOTE =
  "UNDP HDR latest recalculated series. Ranks are not back-comparable to older printed Human Development Reports.";

const WIDE = /^(hdi|ihdi|gdi|gii|mys|eys)_(\d{4})$/;

function prefixToIndicator(prefix: string, indicators: IndicatorDefinition[]): IndicatorDefinition | undefined {
  if (prefix === "hdi" || prefix === "ihdi" || prefix === "gdi" || prefix === "gii") {
    return indicators.find((i) => i.id === prefix);
  }
  if (prefix === "mys") return indicators.find((i) => i.id === "mean-years-schooling");
  if (prefix === "eys") return indicators.find((i) => i.id === "expected-years-schooling");
  return undefined;
}

export async function parseHdr(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
): Promise<Map<string, EntitySourceBag>> {
  if (!fs.existsSync(RAW_HDR)) return new Map();
  const pins = fs.readdirSync(RAW_HDR).find((n) => n.endsWith(".csv") && n.toLowerCase().includes("hdr"));
  const csvPath = pins
    ? path.join(RAW_HDR, pins)
    : path.join(RAW_HDR, "HDR25_Composite_indices_complete_time_series.csv");
  if (!fs.existsSync(csvPath)) return new Map();
  const { header, rows } = parseCsvText(fs.readFileSync(csvPath, "utf8"));
  const yearCols = header.filter((h) => WIDE.test(h));
  const out = new Map<string, EntitySourceBag>();

  for (const rec of rows) {
    const entity = resolveEntity(index, { iso3: rec.iso3 });
    if (!entity) continue;
    let bag = out.get(entity.id);
    if (!bag) {
      bag = new Map();
      out.set(entity.id, bag);
    }
    for (const col of yearCols) {
      const m = col.match(WIDE);
      if (!m) continue;
      const indicator = prefixToIndicator(m[1]!, indicators);
      if (!indicator) continue;
      const year = Number.parseInt(m[2]!, 10);
      const value = parseNumericCell(rec[col]);
      if (value == null) continue;
      const original = indicator.preferredSource === "undp-hdr" ? indicator.sourceIndicatorId : m[1]!;
      pushPoint(bag, indicator.id, original, { year, value, status: "actual" }, HDR_NOTE);
    }
  }
  await parseHdrMpi(index, indicators, out);
  return out;
}

async function parseHdrMpi(
  index: EntityIndex,
  indicators: IndicatorDefinition[],
  out: Map<string, EntitySourceBag>,
): Promise<void> {
  const mpiDef = indicators.find((i) => i.id === "mpi");
  const xlsx = fs.existsSync(RAW_HDR)
    ? fs.readdirSync(RAW_HDR).find((n) => /mpi/i.test(n) && n.toLowerCase().endsWith(".xlsx"))
    : undefined;
  if (!mpiDef || !xlsx) return;
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(RAW_HDR, xlsx));
    const sheet = wb.worksheets[0];
    if (!sheet) return;
    let headerRow = 1;
    let headers: string[] = [];
    for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
      const row: string[] = [];
      sheet.getRow(r).eachCell((cell, col) => {
        row[col] = String(cell.text ?? cell.value ?? "").trim();
      });
      if (row.some((h) => /iso\s*3|iso3|^iso$/i.test(h ?? ""))) {
        headerRow = r;
        headers = row;
        break;
      }
    }
    const isoCol = headers.findIndex((h) => /iso\s*3|iso3|^iso$/i.test(h ?? ""));
    const mpiCol = headers.findIndex((h) => /^mpi$/i.test(h ?? "") || /multidimensional poverty index/i.test(h ?? ""));
    const yearCol = headers.findIndex((h) => /year|survey year/i.test(h ?? ""));
    if (isoCol < 1 || mpiCol < 1) {
      console.warn("HDR MPI table has no ISO3 column; skipped rather than joining on English names.");
      return;
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const iso3 = String(row.getCell(isoCol).text ?? row.getCell(isoCol).value ?? "").trim();
      const entity = resolveEntity(index, { iso3 });
      if (!entity) return;
      const value = parseNumericCell(String(row.getCell(mpiCol).value ?? ""));
      if (value == null) return;
      const yearRaw = yearCol > 0 ? String(row.getCell(yearCol).value ?? "") : "";
      const yearMatch = yearRaw.match(/(\d{4})/);
      const year = yearMatch ? Number.parseInt(yearMatch[1]!, 10) : 2023;
      let bag = out.get(entity.id);
      if (!bag) {
        bag = new Map();
        out.set(entity.id, bag);
      }
      pushPoint(bag, "mpi", "mpi", { year, value, status: "actual" }, HDR_NOTE);
    });
  } catch (err) {
    console.warn(`HDR MPI parse skipped: ${err instanceof Error ? err.message : err}`);
  }
}

export function hdrObservation(
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
  });
}
