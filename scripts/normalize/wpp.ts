import fs from "node:fs";
import zlib from "node:zlib";
import type { Entity, IndicatorDefinition, Observation, ObservationStatus } from "@geo-index/schema";
import { parseCsvLine, rowToRecord, stripBom } from "../lib/csv.ts";
import { type EntityIndex, padM49, resolveEntity } from "../lib/join.ts";
import { parseNumericCell, scaleWppValue, wppStatus } from "../lib/values.ts";
import { WPP_GZ } from "../lib/paths.ts";
import type { FetchMeta } from "../fetch/wpp.ts";

export type IndicatorPoints = {
  indicator: IndicatorDefinition;
  points: { year: number; value: number; status: ObservationStatus }[];
};

export type EntityWpp = Map<string, IndicatorPoints>;

const COUNTRY_LOC_TYPE = "4";

export function streamWppCsv(onRow: (rec: Record<string, string>) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const inp = fs.createReadStream(WPP_GZ);
    const gunzip = zlib.createGunzip();
    let header: string[] | undefined;
    let buf = "";
    inp.on("error", reject);
    gunzip.on("error", reject);
    inp.pipe(gunzip);
    gunzip.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const parts = buf.split(/\n/);
      buf = parts.pop() ?? "";
      for (let line of parts) {
        line = stripBom(line.replace(/\r$/, ""));
        if (!line) continue;
        if (!header) {
          header = parseCsvLine(line);
          continue;
        }
        onRow(rowToRecord(header, parseCsvLine(line)));
      }
    });
    gunzip.on("end", () => {
      const last = stripBom(buf.replace(/\r$/, ""));
      if (last && header) onRow(rowToRecord(header, parseCsvLine(last)));
      resolve();
    });
  });
}

export async function parseWpp(
  index: EntityIndex,
  columns: Map<string, IndicatorDefinition>,
  meta: FetchMeta,
  estimateLastYear: number,
): Promise<Map<string, EntityWpp>> {
  const out = new Map<string, EntityWpp>();
  const unmatched = new Set<string>();

  await streamWppCsv((rec) => {
    if (rec.LocTypeID !== COUNTRY_LOC_TYPE) return;
    const year = Number.parseInt(rec.Time ?? "", 10);
    if (!Number.isInteger(year)) return;
    const entity = resolveEntity(index, {
      iso3: rec.ISO3_code,
      iso2: rec.ISO2_code,
      m49: padM49(rec.LocID ?? ""),
    });
    if (!entity) {
      if (rec.ISO3_code) unmatched.add(`${rec.ISO3_code}|${rec.LocID}`);
      return;
    }
    let bucket = out.get(entity.id);
    if (!bucket) {
      bucket = new Map();
      out.set(entity.id, bucket);
    }
    const status = wppStatus(year, estimateLastYear);
    for (const [column, indicator] of columns) {
      const raw = parseNumericCell(rec[column]);
      if (raw == null) continue;
      const value = scaleWppValue(column, raw);
      let series = bucket.get(indicator.id);
      if (!series) {
        series = { indicator, points: [] };
        bucket.set(indicator.id, series);
      }
      series.points.push({ year, value, status });
    }
  });

  if (unmatched.size) {
    console.warn(`WPP: skipped ${unmatched.size} country/area codes not in the entity catalog`);
  }
  return out;
}

export function wppObservation(
  entity: Entity,
  indicator: IndicatorDefinition,
  points: { year: number; value: number; status: ObservationStatus }[],
  asOfYear: number,
  meta: FetchMeta,
): Observation | null {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const eligible = sorted.filter((p) => p.year <= asOfYear);
  const latest = (eligible.length ? eligible : sorted).at(-1);
  if (!latest) return null;
  const thousands = indicator.unit === "persons";
  return {
    indicatorId: indicator.id,
    entityId: entity.id,
    value: latest.value,
    unit: indicator.unit,
    period: { year: latest.year },
    status: latest.status,
    sourceId: "un-wpp",
    dataset: meta.dataset,
    originalIndicatorId: indicator.sourceIndicatorId,
    retrievedAt: meta.retrievedAt,
    vintage: meta.vintage,
    licenseId: meta.licenseId,
    notes: thousands
      ? "WPP reports population stocks and selected flows in thousands; converted to persons (* 1000)."
      : undefined,
    series: sorted.map((p) => ({
      period: String(p.year),
      value: p.value,
      status: p.status,
    })),
  };
}
