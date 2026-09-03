import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  FETCH_USER_AGENT,
  NACIS_BASE,
  NE_ASSETS,
  S3_BASE,
  type NeAsset,
  type NeAssetId,
} from "./constants.ts";

export type FetchedAsset = {
  id: NeAssetId;
  zipPath: string;
  sha256: string;
};

async function downloadTo(url: string, dest: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": FETCH_USER_AGENT,
      Accept: "application/zip,application/octet-stream,*/*",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error(`GET ${url} returned a tiny body (${buffer.length} bytes)`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
}

function sha256File(file: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

async function ensureAsset(rawDir: string, asset: NeAsset): Promise<FetchedAsset | undefined> {
  const zipName = path.basename(asset.cdnPath);
  const zipPath = path.join(rawDir, zipName);
  const shaPath = `${zipPath}.sha256`;
  const candidates = [`${NACIS_BASE}/${asset.cdnPath}`, `${S3_BASE}/${asset.s3Path}`];

  if (!fs.existsSync(zipPath)) {
    let lastError: unknown;
    for (const url of candidates) {
      try {
        process.stdout.write(`Downloading ${url}\n`);
        await downloadTo(url, zipPath);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      }
    }
    if (!fs.existsSync(zipPath)) {
      if (asset.required) {
        throw new Error(
          `Failed to download required Natural Earth asset ${asset.id}: ${String(lastError)}`,
        );
      }
      process.stderr.write(
        `Optional Natural Earth asset skipped (${asset.id}): ${String(lastError)}\n`,
      );
      return undefined;
    }
  } else {
    process.stdout.write(`Using cached ${zipName}\n`);
  }

  const sha256 = sha256File(zipPath);
  fs.writeFileSync(shaPath, `${sha256}  ${zipName}\n`, "utf8");
  return { id: asset.id, zipPath, sha256 };
}

export async function fetchNaturalEarth(rawDir: string): Promise<Map<NeAssetId, FetchedAsset>> {
  fs.mkdirSync(rawDir, { recursive: true });
  const out = new Map<NeAssetId, FetchedAsset>();
  for (const asset of NE_ASSETS) {
    const fetched = await ensureAsset(rawDir, asset);
    if (fetched) out.set(fetched.id, fetched);
  }
  if (!out.has("countries_lakes") && !out.has("countries")) {
    throw new Error("No Natural Earth 50m admin-0 countries zip is available");
  }
  return out;
}

export function countriesZip(assets: Map<NeAssetId, FetchedAsset>): FetchedAsset {
  return assets.get("countries_lakes") ?? assets.get("countries")!;
}
