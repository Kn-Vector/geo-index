import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../catalog.ts";

type Position = [number, number];
type Ring = Position[];
type GeoGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: "Point"; coordinates: Position }
  | { type: string; coordinates: unknown };

type GeoFeature = {
  properties?: { id?: string; slug?: string };
  geometry?: GeoGeometry | null;
};

let featureCache: Map<string, GeoFeature> | undefined;

function loadFeatures(): Map<string, GeoFeature> {
  if (featureCache) return featureCache;
  featureCache = new Map();
  const root = repoRoot();
  const file = path.join(root, "apps/web/public/geo/countries-50m.geojson");
  const fallback = path.join(root, "public/geo/countries-50m.geojson");
  const target = fs.existsSync(file) ? file : fallback;
  if (!fs.existsSync(target)) return featureCache;
  const fc = JSON.parse(fs.readFileSync(target, "utf8")) as { features?: GeoFeature[] };
  for (const f of fc.features ?? []) {
    const id = f.properties?.id ?? f.properties?.slug;
    if (id) featureCache.set(id, f);
  }
  return featureCache;
}

function ringsOf(geom: GeoGeometry): Ring[] {
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type === "MultiPolygon") return geom.coordinates.flat();
  return [];
}

function simplify(ring: Ring, minDist: number): Ring {
  if (ring.length < 8) return ring;
  const out: Ring = [ring[0]!];
  for (const p of ring) {
    const last = out[out.length - 1]!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) out.push(p);
  }
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) out.push(first);
  return out.length >= 4 ? out : ring;
}

function antimeridianShift(rings: Ring[]): Ring[] {
  const lons = rings.flat().map((p) => p[0]);
  const min = Math.min(...lons);
  const max = Math.max(...lons);
  if (max - min < 180) return rings;
  return rings.map((ring) => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat] as Position));
}

export type Silhouette = {
  svg: string;
  label: string;
};

export function countrySilhouette(entityId: string, name: string): Silhouette | null {
  const feature = loadFeatures().get(entityId);
  const geom = feature?.geometry;
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return null;

  const raw = ringsOf(geom);
  if (!raw.length) return null;
  const rings = antimeridianShift(raw);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const size = 220;
  const pad = 10;
  const inner = size - pad * 2;
  const scale = inner / Math.max(spanX, spanY);
  const ox = pad + (inner - spanX * scale) / 2;
  const oy = pad + (inner - spanY * scale) / 2;

  const minSvgDist = 1.15 / scale;
  const d = rings
    .map((ring) => {
      const simple = simplify(ring, minSvgDist);
      return simple
        .map(([lon, lat], i) => {
          const x = ox + (lon - minX) * scale;
          const y = oy + (maxY - lat) * scale;
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    })
    .join(" Z ") + " Z";

  const titleId = `sil-title-${entityId}`;
  const svg = `<svg class="profile-silhouette" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-labelledby="${titleId}">
  <title id="${titleId}">Outline of ${escapeXml(name)}</title>
  <path d="${d}" fill="currentColor"/>
</svg>`;

  return { svg, label: `Outline of ${name}` };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
