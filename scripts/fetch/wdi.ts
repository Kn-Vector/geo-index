import fs from "node:fs";
import path from "node:path";
import { downloadFile } from "../lib/download.ts";
import { loadEtlSources, loadIndicators, wdiCodesFromCatalog } from "../lib/catalogs.ts";
import { writeSha256Sidecar } from "../lib/hash.ts";
import { RAW_WDI, WDI_EXTRACTED, WDI_META } from "../lib/paths.ts";
import { findExtractedDataCsv, unzipTo } from "../lib/unzip.ts";

export type WdiSeriesMeta = {
  code: string;
  zipPath: string;
  csvPath?: string;
  sha256: string;
  bytes: number;
  skipped: boolean;
  lastUpdatedDate?: string;
  blocker?: string;
};

export type WdiFetchMeta = {
  sourceId: "world-bank-wdi";
  dataset: string;
  vintage: string;
  retrievedAt: string;
  licenseId: string;
  mode: "series";
  seriesUrlTemplate: string;
  series: WdiSeriesMeta[];
  blocker?: string;
};

function readLastUpdated(csvPath: string): string | undefined {
  const head = fs.readFileSync(csvPath, "utf8").slice(0, 2000);
  const m = head.match(/"Last Updated Date","([^"]+)"/);
  return m?.[1];
}

async function fetchOne(
  code: string,
  pin: { seriesUrlTemplate: string },
  force: boolean,
): Promise<WdiSeriesMeta> {
  const url = pin.seriesUrlTemplate.replace("{code}", code);
  const zipPath = path.join(RAW_WDI, `${code}.zip`);
  const sidecar = `${zipPath}.sha256`;
  const expected = fs.existsSync(sidecar)
    ? fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0]?.toLowerCase()
    : undefined;
  try {
    const result = await downloadFile(url, zipPath, {
      expectedSha256: expected && /^[a-f0-9]{64}$/.test(expected) ? expected : undefined,
      force,
      timeoutMs: 120_000,
    });
    if (!fs.existsSync(sidecar)) writeSha256Sidecar(zipPath, result.sha256);
    const tmpDir = path.join(RAW_WDI, `_tmp_${code.replaceAll(".", "_")}`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    unzipTo(zipPath, tmpDir);
    const found = findExtractedDataCsv(tmpDir);
    if (!found) throw new Error(`No API_*.csv in ${code} zip`);
    const csvPath = path.join(WDI_EXTRACTED, `${code}.csv`);
    fs.copyFileSync(found, csvPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(
      `WDI ${code} ${result.skipped ? "cached" : "fetched"} ${(result.bytes / 1024).toFixed(0)} KB`,
    );
    return {
      code,
      zipPath,
      csvPath,
      sha256: result.sha256,
      bytes: result.bytes,
      skipped: result.skipped,
      lastUpdatedDate: readLastUpdated(csvPath),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`WDI ${code} failed: ${message}`);
    return {
      code,
      zipPath,
      sha256: expected ?? "",
      bytes: 0,
      skipped: false,
      blocker: message,
    };
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

export async function fetchWdi(force = false): Promise<WdiFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "world-bank-wdi");
  if (!pin?.seriesUrlTemplate) {
    throw new Error("world-bank-wdi seriesUrlTemplate is not recorded in etl-sources.yaml");
  }
  const codes = wdiCodesFromCatalog(loadIndicators().indicators);
  fs.mkdirSync(WDI_EXTRACTED, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const series = await mapPool(codes, 4, (code) =>
    fetchOne(code, { seriesUrlTemplate: pin.seriesUrlTemplate! }, force),
  );

  const dates = series.map((s) => s.lastUpdatedDate).filter((d): d is string => Boolean(d));
  const latestDate = [...dates].sort().at(-1);
  const vintage = latestDate ? `wdi-${latestDate}` : pin.vintage;
  const failed = series.filter((s) => s.blocker).map((s) => `${s.code}: ${s.blocker}`);
  const meta: WdiFetchMeta = {
    sourceId: "world-bank-wdi",
    dataset: pin.dataset,
    vintage,
    retrievedAt,
    licenseId: pin.licenseId,
    mode: "series",
    seriesUrlTemplate: pin.seriesUrlTemplate,
    series,
    blocker: failed.length ? failed.join("; ") : undefined,
  };
  fs.writeFileSync(WDI_META, JSON.stringify(meta, null, 2));
  if (meta.blocker) {
    fs.writeFileSync(path.join(RAW_WDI, "BLOCKER.md"), `# WDI fetch blockers\n\n- ${failed.join("\n- ")}\n`);
  } else if (fs.existsSync(path.join(RAW_WDI, "BLOCKER.md"))) {
    fs.rmSync(path.join(RAW_WDI, "BLOCKER.md"));
  }
  console.log(`WDI allowlist ${series.filter((s) => !s.blocker).length}/${codes.length} series`);
  return meta;
}
