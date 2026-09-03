import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ROOT, USER_AGENT } from "../lib/paths.ts";
import { downloadCached } from "../lib/download.ts";

export type ManifestAsset = {
  entityId: string;
  role: string;
  commonsTitle: string;
  alt: string;
};

export type ResolvedMedia = {
  entityId: string;
  role: "hero" | "landscape" | "urban" | "architecture" | "culture" | "nature" | "flag" | "emblem" | "silhouette";
  src: string;
  alt: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  creator?: string;
  pageUrl?: string;
  attributionRequired: boolean;
};

type CommonsInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
};

const ALLOWED_ROLES = new Set([
  "hero",
  "landscape",
  "urban",
  "architecture",
  "culture",
  "nature",
  "flag",
  "emblem",
  "silhouette",
]);

export function licenseAllowed(shortName: string, license = ""): boolean {
  const text = `${shortName} ${license}`.toLowerCase();
  if (/\bnc\b|noncommercial|non-commercial/.test(text)) return false;
  if (/\bnd\b|no deriv|noderiv/.test(text)) return false;
  return /cc0|public domain|\bpd[- ]|cc by|cc-by|creative commons cc-by/.test(text);
}

function fileTitle(title: string): string {
  const trimmed = title.replace(/^File:/i, "").trim();
  return `File:${trimmed}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function commonsQuery(title: string, userAgent: string): Promise<CommonsInfo | undefined> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|size|mime");
  url.searchParams.set("iiurlwidth", "1600");
  url.searchParams.set("titles", fileTitle(title));

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("Retry-After") ?? 2) * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Commons API ${res.status} for ${title}`);
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: CommonsInfo[]; missing?: string }> };
    };
    const page = Object.values(json.query?.pages ?? {})[0];
    if (!page || page.missing != null) return undefined;
    return page.imageinfo?.[0];
  }
  return undefined;
}

function decodeEntities(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function loadMediaManifest(): { userAgent: string; assets: ManifestAsset[] } {
  const file = path.join(ROOT, "data/media/manifest.yaml");
  const raw = YAML.parse(fs.readFileSync(file, "utf8")) as {
    userAgent?: string;
    assets?: ManifestAsset[];
  };
  return { userAgent: raw.userAgent || USER_AGENT, assets: raw.assets ?? [] };
}

export async function fetchCommonsAssets(
  assets: ManifestAsset[],
  userAgent: string,
): Promise<{ resolved: ResolvedMedia[]; gaps: string[] }> {
  const resolved: ResolvedMedia[] = [];
  const gaps: string[] = [];
  const destRoot = path.join(ROOT, "apps/web/public/media");
  const rawRoot = path.join(ROOT, "data/raw/commons");
  fs.mkdirSync(destRoot, { recursive: true });
  fs.mkdirSync(rawRoot, { recursive: true });

  let inflight = 0;
  const queue = [...assets];

  const runOne = async (asset: ManifestAsset) => {
    if (!ALLOWED_ROLES.has(asset.role)) {
      gaps.push(`${asset.entityId}/${asset.commonsTitle}: unknown role ${asset.role}`);
      return;
    }
    try {
      const info = await commonsQuery(asset.commonsTitle, userAgent);
      if (!info) {
        gaps.push(`${asset.entityId}/${asset.commonsTitle}: file not found on Commons`);
        return;
      }
      const meta = info.extmetadata ?? {};
      const licenseShort = decodeEntities(meta.LicenseShortName?.value ?? "");
      const license = decodeEntities(meta.License?.value ?? licenseShort);
      if (!licenseAllowed(licenseShort, license)) {
        gaps.push(
          `${asset.entityId}/${asset.commonsTitle}: rejected license “${licenseShort || "unclear"}” (NC/ND/missing not allowed)`,
        );
        return;
      }
      const downloadUrl = info.thumburl || info.url;
      if (!downloadUrl) {
        gaps.push(`${asset.entityId}/${asset.commonsTitle}: no download URL`);
        return;
      }
      const ext = path.extname(new URL(downloadUrl).pathname) || ".jpg";
      const safeName = `${asset.role}${ext.toLowerCase()}`;
      const rawPath = path.join(rawRoot, asset.entityId, safeName);
      await downloadCached(downloadUrl, rawPath, { timeoutMs: 60_000 });
      const publicDir = path.join(destRoot, asset.entityId);
      fs.mkdirSync(publicDir, { recursive: true });
      const publicFile = path.join(publicDir, safeName);
      fs.copyFileSync(rawPath, publicFile);

      const artist = decodeEntities(meta.Artist?.value ?? meta.Credit?.value ?? "Wikimedia Commons");
      const credit = decodeEntities(meta.Credit?.value ?? artist);
      resolved.push({
        entityId: asset.entityId,
        role: asset.role as ResolvedMedia["role"],
        src: `/media/${asset.entityId}/${safeName}`,
        alt: asset.alt,
        credit,
        license: licenseShort || license,
        licenseUrl: meta.LicenseUrl?.value,
        creator: artist,
        pageUrl: info.descriptionurl,
        attributionRequired: !/cc0|public domain/i.test(licenseShort),
      });
    } catch (err) {
      gaps.push(
        `${asset.entityId}/${asset.commonsTitle}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      inflight += 1;
      await runOne(next);
      inflight -= 1;
    }
  });
  await Promise.all(workers);
  void inflight;
  return { resolved, gaps };
}
