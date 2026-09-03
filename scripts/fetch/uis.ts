import fs from "node:fs";
import path from "node:path";
import { downloadCached } from "../lib/download.ts";
import { codesFromCatalog, loadEtlSources, loadIndicators } from "../lib/catalogs.ts";
import { RAW_UNESCO, UNESCO_EXTRACTED, UNESCO_META, USER_AGENT } from "../lib/paths.ts";
import { extractMembers } from "../lib/unzip.ts";
import type { GenericFetchMeta } from "../lib/series.ts";

export type UisFetchMeta = GenericFetchMeta & {
  sourceId: "unesco-uis";
  zips: { filename: string; sha256: string; bytes: number; blocker?: string }[];
  apiFallback?: string[];
};

async function fetchUisApi(code: string, dest: string, force: boolean): Promise<void> {
  if (!force && fs.existsSync(dest)) return;
  const url = `https://api.uis.unesco.org/api/public/data/indicators?indicator=${encodeURIComponent(code)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 120_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!response.ok) throw new Error(`UIS API ${code}: ${response.status}`);
    const json = await response.json();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(json));
  } finally {
    clearTimeout(t);
  }
}

export async function fetchUis(force = false): Promise<UisFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "unesco-uis");
  if (!pin) throw new Error("unesco-uis is not recorded in etl-sources.yaml");
  fs.mkdirSync(RAW_UNESCO, { recursive: true });
  fs.mkdirSync(UNESCO_EXTRACTED, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const zipSpecs = [
    ...(pin.url && pin.filename ? [{ url: pin.url, filename: pin.filename }] : []),
    ...(pin.files ?? []),
  ];
  const zips: UisFetchMeta["zips"] = [];
  const blockers: string[] = [];

  for (const spec of zipSpecs) {
    const dest = path.join(RAW_UNESCO, spec.filename);
    try {
      const result = await downloadCached(spec.url, dest, {
        expectedSha256: spec.sha256,
        force,
        timeoutMs: 600_000,
      });
      zips.push({ filename: spec.filename, sha256: result.sha256, bytes: result.bytes });
      const members = spec.filename.toUpperCase().includes("SDG")
        ? ["SDG_DATA_NATIONAL.csv", "SDG_LABEL.csv"]
        : ["OPRI_DATA_NATIONAL.csv", "OPRI_LABEL.csv"];
      const extracted = extractMembers(dest, UNESCO_EXTRACTED, members);
      if (!extracted.length) {
        throw new Error(`No allowlisted CSV members in ${spec.filename}`);
      }
      console.log(
        `UIS ${spec.filename} ${result.skipped ? "cached" : "fetched"} ${(result.bytes / 1e6).toFixed(1)} MB`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      zips.push({ filename: spec.filename, sha256: spec.sha256 ?? "", bytes: 0, blocker: message });
      blockers.push(`${spec.filename}: ${message}`);
      console.warn(`UIS ${spec.filename} failed: ${message}`);
    }
  }

  const codes = codesFromCatalog(loadIndicators().indicators, "unesco-uis");
  const apiDir = path.join(RAW_UNESCO, "api");
  const apiFallback: string[] = [];
  const extractedHasData =
    fs.existsSync(path.join(UNESCO_EXTRACTED, "OPRI_DATA_NATIONAL.csv")) ||
    fs.existsSync(path.join(UNESCO_EXTRACTED, "SDG_DATA_NATIONAL.csv"));
  if (!extractedHasData) {
    for (const code of codes) {
      try {
        await fetchUisApi(code, path.join(apiDir, `${code}.json`), force);
        apiFallback.push(code);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        blockers.push(`API ${code}: ${message}`);
        console.warn(`UIS API ${code} failed: ${message}`);
      }
    }
    if (apiFallback.length) {
      console.log(`UIS API fallback stored ${apiFallback.length} allowlisted indicators`);
    }
  }

  const meta: UisFetchMeta = {
    sourceId: "unesco-uis",
    dataset: pin.dataset,
    vintage: pin.vintage,
    url: pin.bulkIndexUrl ?? pin.url ?? "",
    filename: pin.filename,
    retrievedAt,
    licenseId: pin.licenseId,
    zips,
    apiFallback: apiFallback.length ? apiFallback : undefined,
    blocker: blockers.length ? blockers.join("; ") : undefined,
  };
  fs.writeFileSync(UNESCO_META, JSON.stringify(meta, null, 2));
  if (meta.blocker) {
    fs.writeFileSync(path.join(RAW_UNESCO, "BLOCKER.md"), `# UIS fetch blockers\n\n- ${blockers.join("\n- ")}\n`);
  } else if (fs.existsSync(path.join(RAW_UNESCO, "BLOCKER.md"))) {
    fs.rmSync(path.join(RAW_UNESCO, "BLOCKER.md"));
  }
  return meta;
}
