import fs from "node:fs";
import path from "node:path";
import { downloadCached } from "../lib/download.ts";
import { codesFromCatalog, loadEtlSources, loadIndicators } from "../lib/catalogs.ts";
import { ILO_META, RAW_ILO } from "../lib/paths.ts";
import type { GenericFetchMeta } from "../lib/series.ts";

export type IloFetchMeta = GenericFetchMeta & {
  sourceId: "ilo-stat";
  series: { code: string; filename: string; sha256: string; bytes: number; blocker?: string }[];
};

function tableId(code: string): string {
  return code.endsWith("_A") ? code : `${code}_A`;
}

export async function fetchIlo(force = false): Promise<IloFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "ilo-stat");
  if (!pin?.seriesUrlTemplate) throw new Error("ilo-stat seriesUrlTemplate is not recorded");
  fs.mkdirSync(RAW_ILO, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const codes = [...new Set(codesFromCatalog(loadIndicators().indicators, "ilo-stat").map(tableId))];
  const series: IloFetchMeta["series"] = [];
  const blockers: string[] = [];

  for (const code of codes) {
    const url = pin.seriesUrlTemplate.replace("{code}", code);
    const filename = `${code}.csv`;
    const dest = path.join(RAW_ILO, filename);
    try {
      const result = await downloadCached(url, dest, { force, timeoutMs: 180_000 });
      series.push({ code, filename, sha256: result.sha256, bytes: result.bytes });
      console.log(`ILO ${code} ${result.skipped ? "cached" : "fetched"} ${(result.bytes / 1e6).toFixed(1)} MB`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      series.push({ code, filename, sha256: "", bytes: 0, blocker: message });
      blockers.push(`${code}: ${message}`);
      console.warn(`ILO ${code} failed: ${message}`);
    }
  }

  const meta: IloFetchMeta = {
    sourceId: "ilo-stat",
    dataset: pin.dataset,
    vintage: pin.vintage,
    url: pin.seriesUrlTemplate,
    retrievedAt,
    licenseId: pin.licenseId,
    estimateLastYear: pin.estimateLastYear,
    series,
    blocker: blockers.length ? blockers.join("; ") : undefined,
  };
  fs.writeFileSync(ILO_META, JSON.stringify(meta, null, 2));
  if (meta.blocker) {
    fs.writeFileSync(path.join(RAW_ILO, "BLOCKER.md"), `# ILOSTAT fetch blockers\n\n- ${blockers.join("\n- ")}\n`);
  } else if (fs.existsSync(path.join(RAW_ILO, "BLOCKER.md"))) {
    fs.rmSync(path.join(RAW_ILO, "BLOCKER.md"));
  }
  return meta;
}
