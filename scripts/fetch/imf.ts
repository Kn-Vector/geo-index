import fs from "node:fs";
import path from "node:path";
import { downloadCached } from "../lib/download.ts";
import { codesFromCatalog, loadEtlSources, loadIndicators } from "../lib/catalogs.ts";
import { IMF_META, RAW_IMF, USER_AGENT } from "../lib/paths.ts";
import type { GenericFetchMeta } from "../lib/series.ts";

export type ImfFetchMeta = GenericFetchMeta & {
  sourceId: "imf-weo";
  excel?: { filename: string; sha256: string; bytes: number; blocker?: string };
  datamapper: { code: string; bytes: number; blocker?: string }[];
};

async function fetchDatamapper(code: string, dest: string, force: boolean): Promise<number> {
  if (!force && fs.existsSync(dest)) return fs.statSync(dest).size;
  const url = `https://www.imf.org/external/datamapper/api/v1/${encodeURIComponent(code)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!response.ok) throw new Error(`DataMapper ${code}: ${response.status}`);
    const json = await response.json();
    fs.writeFileSync(dest, JSON.stringify(json));
    return fs.statSync(dest).size;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchImf(force = false): Promise<ImfFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "imf-weo");
  if (!pin) throw new Error("imf-weo is not recorded in etl-sources.yaml");
  fs.mkdirSync(RAW_IMF, { recursive: true });
  const dmDir = path.join(RAW_IMF, "datamapper");
  fs.mkdirSync(dmDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const blockers: string[] = [];

  let excel: ImfFetchMeta["excel"];
  if (pin.url && pin.filename) {
    const dest = path.join(RAW_IMF, pin.filename);
    try {
      const result = await downloadCached(pin.url, dest, {
        expectedSha256: pin.sha256,
        force,
        timeoutMs: 300_000,
      });
      excel = { filename: pin.filename, sha256: result.sha256, bytes: result.bytes };
      console.log(
        `IMF WEO Excel ${result.skipped ? "cached" : "fetched"} ${(result.bytes / 1e6).toFixed(1)} MB`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      excel = { filename: pin.filename, sha256: pin.sha256 ?? "", bytes: 0, blocker: message };
      blockers.push(`Excel: ${message}`);
      console.warn(`IMF WEO Excel failed: ${message}`);
    }
  }

  const codes = codesFromCatalog(loadIndicators().indicators, "imf-weo");
  const datamapper: ImfFetchMeta["datamapper"] = [];
  for (const code of codes) {
    try {
      const bytes = await fetchDatamapper(code, path.join(dmDir, `${code}.json`), force);
      datamapper.push({ code, bytes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      datamapper.push({ code, bytes: 0, blocker: message });
      blockers.push(`DataMapper ${code}: ${message}`);
      console.warn(`IMF DataMapper ${code} failed: ${message}`);
    }
  }

  const meta: ImfFetchMeta = {
    sourceId: "imf-weo",
    dataset: pin.dataset,
    vintage: pin.vintage,
    url: pin.url ?? pin.bulkUrl ?? "",
    filename: pin.filename,
    sha256: excel?.sha256,
    retrievedAt,
    licenseId: pin.licenseId,
    estimateLastYear: pin.estimateLastYear,
    excel,
    datamapper,
    blocker: blockers.length ? blockers.join("; ") : undefined,
  };
  fs.writeFileSync(IMF_META, JSON.stringify(meta, null, 2));
  if (meta.blocker) {
    fs.writeFileSync(path.join(RAW_IMF, "BLOCKER.md"), `# IMF WEO fetch blockers\n\n- ${blockers.join("\n- ")}\n`);
  } else if (fs.existsSync(path.join(RAW_IMF, "BLOCKER.md"))) {
    fs.rmSync(path.join(RAW_IMF, "BLOCKER.md"));
  }
  if (!excel?.blocker && datamapper.every((d) => !d.blocker)) {
    console.log(`IMF DataMapper ${datamapper.length} series`);
  }
  return meta;
}
