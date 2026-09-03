import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { USER_AGENT } from "./paths.ts";
import { readSha256Sidecar, sha256File, writeSha256Sidecar } from "./hash.ts";

export type DownloadResult = {
  path: string;
  sha256: string;
  bytes: number;
  skipped: boolean;
};

export async function downloadFile(
  url: string,
  dest: string,
  opts: { expectedSha256?: string; timeoutMs?: number; force?: boolean } = {},
): Promise<DownloadResult> {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!opts.force && fs.existsSync(dest) && opts.expectedSha256) {
    const existing = sha256File(dest);
    if (existing === opts.expectedSha256) {
      return { path: dest, sha256: existing, bytes: fs.statSync(dest).size, skipped: true };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok || !response.body) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }

  const tmp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  const hash = sha256File(dest);
  if (opts.expectedSha256 && hash !== opts.expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${path.basename(dest)}: got ${hash}, expected ${opts.expectedSha256}`,
    );
  }
  writeSha256Sidecar(dest, hash);
  return { path: dest, sha256: hash, bytes: fs.statSync(dest).size, skipped: false };
}

/** Re-download only when missing, checksum drifted, or force=true. */
export async function downloadCached(
  url: string,
  dest: string,
  opts: { expectedSha256?: string; timeoutMs?: number; force?: boolean } = {},
): Promise<DownloadResult> {
  const sidecar = opts.expectedSha256 ?? readSha256Sidecar(dest);
  return downloadFile(url, dest, {
    expectedSha256: opts.force ? undefined : sidecar,
    timeoutMs: opts.timeoutMs,
    force: opts.force,
  });
}
