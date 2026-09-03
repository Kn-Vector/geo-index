/**
 * Build versioned zip artifacts for a GitHub Release.
 * Raw WDI/WPP/WEO/UIS blobs stay out of the archives; checksums and catalog
 * files are enough to reproduce `pnpm data:fetch`.
 */
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const outDir = join(root, "dist-release");
const version =
  process.env.RELEASE_VERSION ??
  `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`;

const RAW_META = new Set([
  ".sha256",
  "readme.md",
  "license",
  ".gitkeep",
]);

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function stageChecksums(): string | null {
  const rawRoot = join(root, "data", "raw");
  if (!existsSync(rawRoot)) return null;
  const staging = join(outDir, "staging-checksums");
  mkdirSync(staging, { recursive: true });
  for (const file of walk(rawRoot)) {
    const base = file.split(/[/\\]/).pop() ?? "";
    const allowed =
      RAW_META.has(base.toLowerCase()) || base.toLowerCase().endsWith(".sha256");
    if (!allowed) continue;
    const rel = relative(rawRoot, file);
    const dest = join(staging, "data", "raw", rel);
    mkdirSync(join(dest, ".."), { recursive: true });
    copyFileSync(file, dest);
  }
  return staging;
}

function zipPath(name: string, source: string) {
  const dest = join(outDir, `${name}-${version}.zip`);
  if (process.platform === "win32") {
    execSync(`tar -a -c -f "${dest}" -C "${source}" .`, { stdio: "inherit" });
  } else {
    execSync(`zip -r "${dest}" .`, { cwd: source, stdio: "inherit" });
  }
  console.log(`wrote ${dest}`);
}

function zipRoots(name: string, paths: string[]) {
  const staging = join(outDir, `staging-${name}`);
  mkdirSync(staging, { recursive: true });
  let copied = 0;
  for (const relativePath of paths) {
    const from = join(root, relativePath);
    if (!existsSync(from)) continue;
    const dest = join(staging, relativePath);
    mkdirSync(join(dest, ".."), { recursive: true });
    if (statSync(from).isDirectory()) {
      for (const file of walk(from)) {
        const rel = relative(from, file);
        const target = join(dest, rel);
        mkdirSync(join(target, ".."), { recursive: true });
        copyFileSync(file, target);
        copied += 1;
      }
    } else {
      copyFileSync(from, dest);
      copied += 1;
    }
  }
  if (copied === 0) {
    console.warn(`skip ${name}: nothing to pack`);
    rmSync(staging, { recursive: true, force: true });
    return;
  }
  zipPath(name, staging);
  rmSync(staging, { recursive: true, force: true });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

zipRoots("geo-index-catalog", ["data/catalog", "data/themes", "data/media"]);
const checksums = stageChecksums();
if (checksums) {
  zipPath("geo-index-checksums", checksums);
  rmSync(checksums, { recursive: true, force: true });
}
zipRoots("geo-index-generated", ["data/generated"]);
zipRoots("geo-index-geo", [
  "apps/web/public/geo",
  "apps/web/public/silhouettes",
  "apps/web/public/flags",
]);
zipRoots("geo-index-media", ["apps/web/public/media"]);

console.log(`packed ${version} into ${outDir}`);
