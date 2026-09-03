import fs from "node:fs";
import path from "node:path";
import { downloadFile } from "../lib/download.ts";
import { loadEtlSources } from "../lib/catalogs.ts";
import { writeSha256Sidecar } from "../lib/hash.ts";
import { RAW_WPP, WPP_GZ, WPP_META } from "../lib/paths.ts";

export type FetchMeta = {
  sourceId: string;
  dataset: string;
  vintage: string;
  url: string;
  filename: string;
  sha256: string;
  retrievedAt: string;
  bytes: number;
  skipped: boolean;
  licenseId: string;
  blocker?: string;
};

export async function fetchWpp(force = false): Promise<FetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "un-wpp");
  if (!pin?.url || !pin.filename) {
    throw new Error("un-wpp URL is not recorded in data/catalog/etl-sources.yaml");
  }
  fs.mkdirSync(RAW_WPP, { recursive: true });
  const retrievedAt = new Date().toISOString();
  try {
    const result = await downloadFile(pin.url, WPP_GZ, {
      expectedSha256: pin.sha256,
      force,
      timeoutMs: 300_000,
    });
    if (!fs.existsSync(`${WPP_GZ}.sha256`)) writeSha256Sidecar(WPP_GZ, result.sha256);
    const meta: FetchMeta = {
      sourceId: "un-wpp",
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
    fs.writeFileSync(WPP_META, JSON.stringify(meta, null, 2));
    console.log(
      result.skipped
        ? `WPP checksum OK (${result.sha256.slice(0, 12)}…) — skipped download`
        : `WPP fetched ${path.basename(WPP_GZ)} ${(result.bytes / 1e6).toFixed(1)} MB sha256=${result.sha256}`,
    );
    return meta;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const meta: FetchMeta = {
      sourceId: "un-wpp",
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
    fs.writeFileSync(WPP_META, JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(RAW_WPP, "BLOCKER.md"), `# WPP fetch blocker\n\n${message}\n`);
    console.warn(`WPP fetch failed: ${message}`);
    return meta;
  }
}
