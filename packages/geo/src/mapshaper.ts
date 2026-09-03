import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FeatureCollection } from "./geojson.ts";

type Mapshaper = {
  applyCommands: (commands: string) => Promise<Record<string, string | Buffer>>;
};

function loadMapshaper(): Mapshaper {
  const require = createRequire(import.meta.url);
  return require("mapshaper") as Mapshaper;
}

function q(filePath: string): string {
  return `"${filePath.replace(/\\/g, "/")}"`;
}

function pickFeatureCollection(output: Record<string, string | Buffer>): FeatureCollection {
  const collections: FeatureCollection[] = [];
  for (const value of Object.values(output)) {
    const text = typeof value === "string" ? value : value.toString("utf8");
    if (!text.includes("FeatureCollection")) continue;
    try {
      const parsed = JSON.parse(text) as FeatureCollection;
      if (parsed.type === "FeatureCollection" && Array.isArray(parsed.features) && parsed.features.length > 0) {
        collections.push(parsed);
      }
    } catch {
      // skip companion files such as .VERSION
    }
  }
  if (collections.length === 0) {
    throw new Error("mapshaper did not return a non-empty FeatureCollection");
  }
  collections.sort((a, b) => b.features.length - a.features.length);
  return collections[0];
}

export async function shapefileZipToGeoJSON(
  zipPath: string,
  options: { clean?: boolean } = {},
): Promise<FeatureCollection> {
  const mapshaper = loadMapshaper();
  const clean = options.clean === false ? "" : " -clean";
  const output = await mapshaper.applyCommands(
    `-i ${q(zipPath)} encoding=utf8${clean} -o format=geojson gj2008`,
  );
  return pickFeatureCollection(output);
}

export async function projectRobinson(
  collection: FeatureCollection,
): Promise<FeatureCollection> {
  const mapshaper = loadMapshaper();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-index-robin-"));
  const inFile = path.join(tmpDir, "in.json");
  try {
    fs.writeFileSync(inFile, JSON.stringify(collection));
    const output = await mapshaper.applyCommands(`-i ${q(inFile)} -proj robin -o format=geojson`);
    return pickFeatureCollection(output);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
