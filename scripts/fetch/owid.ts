import fs from "node:fs";
import path from "node:path";
import { downloadCached } from "../lib/download.ts";
import { loadEtlSources } from "../lib/catalogs.ts";
import { OWID_META, RAW_OWID } from "../lib/paths.ts";
import type { GenericFetchMeta } from "../lib/series.ts";

export type OwidFetchMeta = GenericFetchMeta & { sourceId: "owid-co2" };

export async function fetchOwid(force = false): Promise<OwidFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "owid-co2");
  if (!pin?.url || !pin.filename) throw new Error("owid-co2 URL is not recorded in etl-sources.yaml");
  fs.mkdirSync(RAW_OWID, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const dest = path.join(RAW_OWID, pin.filename);
  try {
    const result = await downloadCached(pin.url, dest, {
      expectedSha256: pin.sha256,
      force,
      timeoutMs: 300_000,
    });
    const meta: OwidFetchMeta = {
      sourceId: "owid-co2",
      dataset: pin.dataset,
      vintage: pin.vintage,
      url: pin.url,
      filename: pin.filename,
      sha256: result.sha256,
      retrievedAt,
      bytes: result.bytes,
      skipped: result.skipped,
      licenseId: pin.licenseId,
    };
    fs.writeFileSync(OWID_META, JSON.stringify(meta, null, 2));
    console.log(
      result.skipped
        ? `OWID CO2 checksum OK — skipped download`
        : `OWID CO2 fetched ${pin.filename} ${(result.bytes / 1e6).toFixed(1)} MB`,
    );
    return meta;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const meta: OwidFetchMeta = {
      sourceId: "owid-co2",
      dataset: pin.dataset,
      vintage: pin.vintage,
      url: pin.url,
      filename: pin.filename,
      sha256: pin.sha256 ?? "",
      retrievedAt,
      bytes: 0,
      skipped: false,
      licenseId: pin.licenseId,
      blocker: message,
    };
    fs.writeFileSync(OWID_META, JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(RAW_OWID, "BLOCKER.md"), `# OWID CO2 fetch blocker\n\n${message}\n`);
    console.warn(`OWID CO2 fetch failed: ${message}`);
    return meta;
  }
}
