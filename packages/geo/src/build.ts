import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import YAML from "yaml";
import { entityCatalogSchema, type Entity } from "@geo-index/schema";
import {
  ENTITY_CATALOG,
  GLOBE_OUTPUT_DIR,
  GLOBE_ROOT_OUTPUT_DIR,
  NATURAL_EARTH_VERSION,
  NE_RAW_DIR,
  OVERLAY_ENTITY_IDS,
} from "./constants.ts";
import { countriesZip, fetchNaturalEarth } from "./fetch-ne.ts";
import {
  asProps,
  featureCenter,
  isPointGeometry,
  isPolygonGeometry,
  largestPolygonAreaDeg2,
  type Feature,
  type FeatureCollection,
  type Geometry,
} from "./geojson.ts";
import {
  buildEntityLookup,
  entityToGlobeProps,
  isNeTinyFlag,
  joinFeatureToEntity,
  type EntityLookup,
  type GlobeFeatureProps,
} from "./join.ts";
import { projectRobinson, shapefileZipToGeoJSON } from "./mapshaper.ts";
import { globeStyleJson } from "./style.ts";
import { projectedToRobinsonSvg } from "./svg.ts";

export type GlobeIndexEntry = {
  id: string;
  slug: string;
  name: string;
  iso2?: string;
  iso3?: string;
  tier: string;
  classification: string;
  tiny: boolean;
  center: [number, number];
};

export type GlobeIndex = {
  naturalEarthVersion: string;
  generatedAt: string;
  attribution: string;
  entities: GlobeIndexEntry[];
};

export type BuildResult = {
  countries: number;
  tiny: number;
  disputed: number;
  index: number;
  palestineSelectable: boolean;
  outDir: string;
};

const OVERLAY = new Set<string>(OVERLAY_ENTITY_IDS);
/** Square degrees: Singapore-scale and smaller need a hit point even if a sliver polygon exists. */
const TINY_AREA_DEG2 = 0.12;

function loadCatalog(root: string): Entity[] {
  const file = path.join(root, ENTITY_CATALOG);
  const catalog = entityCatalogSchema.parse(YAML.parse(fs.readFileSync(file, "utf8")));
  return catalog.entities;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, "utf8");
}

function cloneGeometry(geom: Geometry): Geometry {
  return JSON.parse(JSON.stringify(geom)) as Geometry;
}

function geometriesEqual(a: Geometry | null, b: Geometry | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pointFeature(
  entity: Entity,
  geom: Geometry,
  tiny = true,
): Feature<GlobeFeatureProps> {
  return {
    type: "Feature",
    id: entity.id,
    properties: entityToGlobeProps(entity, { tiny }),
    geometry: cloneGeometry(geom),
  };
}

function polygonFeature(
  entity: Entity,
  geom: Geometry,
  extra?: Partial<GlobeFeatureProps>,
): Feature<GlobeFeatureProps> {
  return {
    type: "Feature",
    id: entity.id,
    properties: entityToGlobeProps(entity, extra),
    geometry: cloneGeometry(geom),
  };
}

function shouldTreatAsTiny(props: Record<string, unknown>, geom: Geometry | null): boolean {
  if (!geom) return false;
  if (isPointGeometry(geom)) return true;
  if (isNeTinyFlag(props.TINY ?? props.tiny)) return true;
  if (isPolygonGeometry(geom) && largestPolygonAreaDeg2(geom) > 0 && largestPolygonAreaDeg2(geom) < TINY_AREA_DEG2) {
    return true;
  }
  return false;
}

function firstPointGeometry(geom: Geometry): Geometry | null {
  if (geom.type === "Point" || geom.type === "MultiPoint") return geom;
  const [lng, lat] = featureCenter(geom);
  return { type: "Point", coordinates: [lng, lat] };
}

function copyFlags(root: string, entities: Entity[], destDir: string): void {
  const require = createRequire(import.meta.url);
  let flagRoot: string;
  try {
    flagRoot = path.dirname(require.resolve("flag-icons/package.json"));
  } catch {
    process.stderr.write("flag-icons not installed; skipping flag copy\n");
    return;
  }
  const srcDir = path.join(flagRoot, "flags", "4x3");
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  const seen = new Set<string>();
  for (const entity of entities) {
    const iso2 = entity.isoAlpha2?.toLowerCase();
    if (!iso2 || seen.has(iso2)) continue;
    seen.add(iso2);
    const src = path.join(srcDir, `${iso2}.svg`);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(destDir, `${iso2}.svg`));
    copied += 1;
  }
  process.stdout.write(`Copied ${copied} flag SVGs\n`);
}

function assertPalestineSelectable(
  countries: FeatureCollection<GlobeFeatureProps>,
  tiny: FeatureCollection<GlobeFeatureProps>,
): void {
  const palestine =
    countries.features.find((f) => f.properties.id === "palestine") ??
    tiny.features.find((f) => f.properties.id === "palestine");
  const israel = countries.features.find((f) => f.properties.id === "israel");
  if (!palestine?.geometry) {
    throw new Error("Palestine is missing from globe geometry (join ADM0_A3=PSX)");
  }
  if (!israel?.geometry) {
    throw new Error("Israel is missing from countries-50m.geojson");
  }
  if (geometriesEqual(palestine.geometry, israel.geometry)) {
    throw new Error("Palestine geometry is identical to Israel — not independently selectable");
  }
  if (palestine.properties.slug !== "palestine") {
    throw new Error("Palestine slug must be palestine");
  }
  if (palestine.properties.iso3 && palestine.properties.iso3 !== "PSE") {
    throw new Error(`Palestine iso3 should be PSE (ISO), not ${palestine.properties.iso3}`);
  }
}

function assertSouthSudan(countries: FeatureCollection<GlobeFeatureProps>): void {
  const ss = countries.features.find((f) => f.properties.id === "south-sudan");
  if (!ss) throw new Error("South Sudan missing (join ADM0_A3=SDS → ISO SSD)");
  if (ss.properties.iso3 !== "SSD") {
    throw new Error(`South Sudan iso3 should be SSD, got ${ss.properties.iso3}`);
  }
}

function missingCore(entities: Entity[], seen: Set<string>): Entity[] {
  return entities.filter((e) => e.tier === "core" && !seen.has(e.id));
}

function sortOverlaysLast(features: Feature<GlobeFeatureProps>[]): Feature<GlobeFeatureProps>[] {
  return [...features].sort((a, b) => {
    const ao = OVERLAY.has(a.properties.id) ? 1 : 0;
    const bo = OVERLAY.has(b.properties.id) ? 1 : 0;
    return ao - bo;
  });
}

function ingestLayer(
  collection: FeatureCollection,
  lookup: EntityLookup,
  into: {
    polygons: Map<string, Feature<GlobeFeatureProps>>;
    points: Map<string, Feature<GlobeFeatureProps>>;
  },
): void {
  for (const raw of collection.features) {
    const props = asProps(raw.properties);
    const entity = joinFeatureToEntity(props, lookup);
    if (!entity || !raw.geometry) continue;

    if (isPolygonGeometry(raw.geometry)) {
      if (!into.polygons.has(entity.id)) {
        into.polygons.set(entity.id, polygonFeature(entity, raw.geometry));
      }
      if (shouldTreatAsTiny(props, raw.geometry) && !into.points.has(entity.id)) {
        const pt = firstPointGeometry(raw.geometry);
        if (pt) into.points.set(entity.id, pointFeature(entity, pt));
      }
    } else if (isPointGeometry(raw.geometry)) {
      if (!into.points.has(entity.id)) {
        into.points.set(entity.id, pointFeature(entity, raw.geometry));
      }
    }
  }
}

function ingestDisputed(
  collection: FeatureCollection,
  lookup: EntityLookup,
  disputeClass: GlobeFeatureProps["disputeClass"],
  polygons: Map<string, Feature<GlobeFeatureProps>>,
): Feature<GlobeFeatureProps>[] {
  const out: Feature<GlobeFeatureProps>[] = [];
  let seq = 0;
  for (const raw of collection.features) {
    if (!raw.geometry) continue;
    const props = asProps(raw.properties);
    const entity = joinFeatureToEntity(props, lookup);
    const name =
      entity?.commonName ??
      (typeof props.NAME === "string" ? props.NAME : undefined) ??
      (typeof props.BRK_NAME === "string" ? props.BRK_NAME : undefined) ??
      "Disputed area";
    const featureId = `disputed-${disputeClass}-${seq++}`;

    if (entity && isPolygonGeometry(raw.geometry) && !polygons.has(entity.id)) {
      polygons.set(entity.id, polygonFeature(entity, raw.geometry));
    }

    out.push({
      type: "Feature",
      id: featureId,
      properties: entity
        ? { ...entityToGlobeProps(entity, { disputeClass }), id: featureId, slug: entity.id }
        : {
            id: featureId,
            slug: featureId,
            name,
            tier: "index-only",
            disputeClass,
          },
      geometry: cloneGeometry(raw.geometry),
    });
  }
  return out;
}

export async function buildGlobeGeometry(root = process.cwd()): Promise<BuildResult> {
  const entities = loadCatalog(root);
  const lookup = buildEntityLookup(entities);
  const rawDir = path.join(root, NE_RAW_DIR);
  const assets = await fetchNaturalEarth(rawDir);

  const polygons = new Map<string, Feature<GlobeFeatureProps>>();
  const points = new Map<string, Feature<GlobeFeatureProps>>();

  process.stdout.write("Converting 50m admin-0 countries…\n");
  const countriesRaw = await shapefileZipToGeoJSON(countriesZip(assets).zipPath);
  ingestLayer(countriesRaw, lookup, { polygons, points });

  const tiny50 = assets.get("tiny_50m");
  if (tiny50) {
    process.stdout.write("Converting 50m tiny-country points…\n");
    ingestLayer(await shapefileZipToGeoJSON(tiny50.zipPath, { clean: false }), lookup, {
      polygons,
      points,
    });
  }

  const tiny10 = assets.get("tiny_10m");
  if (tiny10) {
    process.stdout.write("Converting 10m tiny-country points (fill gaps)…\n");
    const before = new Set(points.keys());
    ingestLayer(await shapefileZipToGeoJSON(tiny10.zipPath, { clean: false }), lookup, {
      polygons,
      points,
    });
    for (const id of points.keys()) {
      if (!before.has(id) && polygons.has(id) && !shouldTreatAsTiny({}, polygons.get(id)!.geometry)) {
        // 10m points for countries that already have a large polygon are not needed as hit targets.
        if (largestPolygonAreaDeg2(polygons.get(id)!.geometry) >= TINY_AREA_DEG2) {
          points.delete(id);
        }
      }
    }
  }

  const disputedFeatures: Feature<GlobeFeatureProps>[] = [];
  const disputedPoly = assets.get("disputed_poly");
  if (disputedPoly) {
    process.stdout.write("Converting disputed polygons…\n");
    disputedFeatures.push(
      ...ingestDisputed(
        await shapefileZipToGeoJSON(disputedPoly.zipPath),
        lookup,
        "breakaway",
        polygons,
      ),
    );
  }
  const disputedLines = assets.get("disputed_lines");
  if (disputedLines) {
    process.stdout.write("Converting disputed boundary lines…\n");
    disputedFeatures.push(
      ...ingestDisputed(
        await shapefileZipToGeoJSON(disputedLines.zipPath, { clean: false }),
        lookup,
        "boundary",
        polygons,
      ),
    );
  }

  const seen = new Set([...polygons.keys(), ...points.keys()]);
  const missing = missingCore(entities, seen);
  if (missing.length) {
    const names = missing.map((e) => `${e.id} (${e.naturalEarth?.adm0A3 ?? e.isoAlpha3})`).join(", ");
    throw new Error(`Core entities without globe geometry: ${names}`);
  }

  for (const [id, poly] of polygons) {
    if (points.has(id)) continue;
    if (shouldTreatAsTiny({}, poly.geometry)) {
      const pt = poly.geometry ? firstPointGeometry(poly.geometry) : null;
      const entity = entities.find((e) => e.id === id);
      if (pt && entity) points.set(id, pointFeature(entity, pt));
    }
  }

  const countryFeatures = sortOverlaysLast([...polygons.values()]);
  const tinyFeatures = [...points.values()];
  const countries: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: countryFeatures,
  };
  const tiny: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: tinyFeatures,
  };
  const disputed: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: disputedFeatures,
  };

  const palestine = countries.features.find((f) => f.properties.id === "palestine");
  const israel = countries.features.find((f) => f.properties.id === "israel");
  if (
    palestine &&
    israel &&
    geometriesEqual(palestine.geometry, israel.geometry)
  ) {
    const fromDispute = disputedFeatures.find(
      (f) => f.properties.slug === "palestine" && isPolygonGeometry(f.geometry),
    );
    if (fromDispute?.geometry) {
      palestine.geometry = cloneGeometry(fromDispute.geometry);
    }
  }

  assertPalestineSelectable(countries, tiny);
  assertSouthSudan(countries);

  const indexEntities: GlobeIndexEntry[] = entities
    .filter((e) => seen.has(e.id))
    .map((e) => {
      const poly = polygons.get(e.id);
      const pt = points.get(e.id);
      const geom = poly?.geometry ?? pt?.geometry ?? null;
      const entry: GlobeIndexEntry = {
        id: e.id,
        slug: e.id,
        name: e.commonName,
        tier: e.tier,
        classification: e.classification,
        tiny: Boolean(pt) && (!poly || shouldTreatAsTiny({}, poly.geometry)),
        center: featureCenter(geom),
      };
      if (e.isoAlpha2) entry.iso2 = e.isoAlpha2;
      if (e.isoAlpha3) entry.iso3 = e.isoAlpha3;
      return entry;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const index: GlobeIndex = {
    naturalEarthVersion: NATURAL_EARTH_VERSION,
    generatedAt: new Date().toISOString(),
    attribution: "Made with Natural Earth",
    entities: indexEntities,
  };

  process.stdout.write("Projecting Robinson SVG fallback…\n");
  const forSvg: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: [...countryFeatures, ...tinyFeatures],
  };
  const projected = (await projectRobinson(forSvg)) as FeatureCollection<GlobeFeatureProps>;
  const projectedCountries: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: projected.features.filter((f) => isPolygonGeometry(f.geometry)),
  };
  const projectedTiny: FeatureCollection<GlobeFeatureProps> = {
    type: "FeatureCollection",
    features: projected.features.filter((f) => isPointGeometry(f.geometry)),
  };
  const svg = projectedToRobinsonSvg(projectedCountries, projectedTiny);

  const outDir = path.join(root, GLOBE_OUTPUT_DIR);
  const rootOut = path.join(root, GLOBE_ROOT_OUTPUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(rootOut, { recursive: true });

  const outputs: Record<string, unknown> = {
    "countries-50m.geojson": countries,
    "tiny-countries.geojson": tiny,
    "disputed.geojson": disputed,
    "index.json": index,
    "globe-style.json": globeStyleJson(),
  };
  for (const [name, value] of Object.entries(outputs)) {
    writeJson(path.join(outDir, name), value);
    writeJson(path.join(rootOut, name), value);
  }
  fs.writeFileSync(path.join(outDir, "world-robinson.svg"), svg, "utf8");
  fs.writeFileSync(path.join(rootOut, "world-robinson.svg"), svg, "utf8");

  copyFlags(root, entities, path.join(root, "apps/web/public/flags"));

  process.stdout.write(
    `geo:build wrote ${countryFeatures.length} country polygons, ${tinyFeatures.length} tiny points, ${disputedFeatures.length} disputed features → ${outDir}\n`,
  );

  return {
    countries: countryFeatures.length,
    tiny: tinyFeatures.length,
    disputed: disputedFeatures.length,
    index: indexEntities.length,
    palestineSelectable: Boolean(palestine),
    outDir,
  };
}
