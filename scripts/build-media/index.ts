import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { CATALOG_DIR, GENERATED_DIR, ROOT } from "../lib/paths.ts";
import { fetchCommonsAssets, loadMediaManifest } from "./commons.ts";
import { writeOgImages } from "./og.ts";
import { writeSilhouettes } from "./silhouettes.ts";
import { buildThemes } from "./themes.ts";

type EntityLite = { id: string; commonName: string; isoAlpha2?: string };

function loadEntities(): EntityLite[] {
  const raw = YAML.parse(fs.readFileSync(path.join(CATALOG_DIR, "entities.yaml"), "utf8")) as {
    entities: EntityLite[];
  };
  return raw.entities;
}

async function main(): Promise<void> {
  const entities = loadEntities();
  const flagDir = path.join(ROOT, "apps/web/public/flags");
  const silDir = path.join(ROOT, "apps/web/public/silhouettes");
  const ogDir = path.join(ROOT, "apps/web/public/og");
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const themes = buildThemes(entities, flagDir);
  fs.writeFileSync(path.join(GENERATED_DIR, "themes.json"), JSON.stringify(themes, null, 2));
  const failed = themes.filter((t) => t.contrastOnPaper < 4.5 && t.contrastOnInk < 4.5);
  if (failed.length) {
    throw new Error(`Theme contrast failures: ${failed.map((t) => t.entityId).join(", ")}`);
  }

  const sil = writeSilhouettes(entities, silDir);
  const og = writeOgImages(entities, ogDir, flagDir);

  const manifest = loadMediaManifest();
  let resolved: Awaited<ReturnType<typeof fetchCommonsAssets>>["resolved"] = [];
  let gaps: string[] = [];
  try {
    const fetched = await fetchCommonsAssets(manifest.assets, manifest.userAgent);
    resolved = fetched.resolved;
    gaps = fetched.gaps;
  } catch (err) {
    gaps.push(`Commons fetch aborted: ${err instanceof Error ? err.message : String(err)}`);
  }

  fs.writeFileSync(path.join(GENERATED_DIR, "media.json"), JSON.stringify(resolved, null, 2));
  const gapDoc = [
    "# Media pipeline gaps",
    "",
    "Missing photographs are omitted rather than replaced with invented or unlicensed images.",
    "",
    `Silhouettes written: ${sil.written}. Missing geometry: ${sil.missing.length ? sil.missing.join(", ") : "none"}.`,
    `Commons accepted: ${resolved.length}. Rejected or missing: ${gaps.length}.`,
    "",
    ...gaps.map((g) => `- ${g}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(GENERATED_DIR, "media-gaps.md"), gapDoc);

  console.log(
    `media:build themes=${themes.length} silhouettes=${sil.written} og=${og.written} photos=${resolved.length} gaps=${gaps.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
