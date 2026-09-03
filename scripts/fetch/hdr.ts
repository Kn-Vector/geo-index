import fs from "node:fs";
import path from "node:path";
import { downloadCached } from "../lib/download.ts";
import { loadEtlSources } from "../lib/catalogs.ts";
import { HDR_META, RAW_HDR } from "../lib/paths.ts";
import type { GenericFetchMeta } from "../lib/series.ts";

export type HdrFetchMeta = GenericFetchMeta & {
  sourceId: "undp-hdr";
  mpi?: { filename: string; sha256: string; bytes: number; blocker?: string };
};

export async function fetchHdr(force = false): Promise<HdrFetchMeta> {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "undp-hdr");
  if (!pin?.url || !pin.filename) throw new Error("undp-hdr URL is not recorded in etl-sources.yaml");
  fs.mkdirSync(RAW_HDR, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const dest = path.join(RAW_HDR, pin.filename);
  try {
    const result = await downloadCached(pin.url, dest, {
      expectedSha256: pin.sha256,
      force,
      timeoutMs: 180_000,
    });
    const meta: HdrFetchMeta = {
      sourceId: "undp-hdr",
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
    const mpiPin = pin.files?.find((f) => f.id === "mpi-tables" || /mpi/i.test(f.filename));
    if (mpiPin) {
      const mpiDest = path.join(RAW_HDR, mpiPin.filename);
      try {
        const mpi = await downloadCached(mpiPin.url, mpiDest, {
          expectedSha256: mpiPin.sha256,
          force,
          timeoutMs: 120_000,
        });
        meta.mpi = { filename: mpiPin.filename, sha256: mpi.sha256, bytes: mpi.bytes };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        meta.mpi = { filename: mpiPin.filename, sha256: "", bytes: 0, blocker: message };
        console.warn(`HDR MPI table failed: ${message}`);
      }
    }
    fs.writeFileSync(HDR_META, JSON.stringify(meta, null, 2));
    console.log(
      result.skipped
        ? `HDR checksum OK — skipped download`
        : `HDR fetched ${pin.filename} ${(result.bytes / 1e6).toFixed(2)} MB`,
    );
    return meta;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const meta: HdrFetchMeta = {
      sourceId: "undp-hdr",
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
    fs.writeFileSync(HDR_META, JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(RAW_HDR, "BLOCKER.md"), `# HDR fetch blocker\n\n${message}\n`);
    console.warn(`HDR fetch failed: ${message}`);
    return meta;
  }
}
