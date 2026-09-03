import type { FeatureCollection, Geometry, Position } from "./geojson.ts";
import { isPointGeometry, isPolygonGeometry } from "./geojson.ts";
import type { GlobeFeatureProps } from "./join.ts";

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function pathFromRing(ring: Position[], sx: number, sy: number, height: number): string {
  if (ring.length === 0) return "";
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const x = round((ring[i][0] - sx) * 1);
    const y = round(height - (ring[i][1] - sy));
    d += `${i === 0 ? "M" : "L"}${x} ${y}`;
  }
  return `${d}Z`;
}

function geometryToPath(geom: Geometry, sx: number, sy: number, height: number): string {
  if (geom.type === "Polygon") {
    return geom.coordinates.map((ring) => pathFromRing(ring, sx, sy, height)).join("");
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates
      .flatMap((poly) => poly.map((ring) => pathFromRing(ring, sx, sy, height)))
      .join("");
  }
  return "";
}

function extentOf(collection: FeatureCollection): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (pos: Position) => {
    minX = Math.min(minX, pos[0]);
    minY = Math.min(minY, pos[1]);
    maxX = Math.max(maxX, pos[0]);
    maxY = Math.max(maxY, pos[1]);
  };
  const walk = (g: Geometry | null) => {
    if (!g) return;
    switch (g.type) {
      case "Point":
        visit(g.coordinates);
        break;
      case "MultiPoint":
      case "LineString":
        g.coordinates.forEach(visit);
        break;
      case "MultiLineString":
      case "Polygon":
        for (const ring of g.coordinates) ring.forEach(visit);
        break;
      case "MultiPolygon":
        for (const poly of g.coordinates) for (const ring of poly) ring.forEach(visit);
        break;
      case "GeometryCollection":
        g.geometries.forEach(walk);
        break;
    }
  };
  for (const feature of collection.features) walk(feature.geometry);
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return { minX, minY, maxX, maxY };
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Robinson SVG world map for the WebGL2 fallback. Paths carry data-slug so
 * the Preact island can wire the same search/list interactions.
 */
export function projectedToRobinsonSvg(
  countries: FeatureCollection<GlobeFeatureProps>,
  tiny: FeatureCollection<GlobeFeatureProps>,
): string {
  const combined: FeatureCollection = {
    type: "FeatureCollection",
    features: [...countries.features, ...tiny.features],
  };
  const { minX, minY, maxX, maxY } = extentOf(combined);
  const pad = (maxX - minX) * 0.02;
  const sx = minX - pad;
  const sy = minY - pad;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const vbW = round(width);
  const vbH = round(height);

  const paths: string[] = [];
  for (const feature of countries.features) {
    if (!feature.geometry || !isPolygonGeometry(feature.geometry)) continue;
    const p = feature.properties;
    const d = geometryToPath(feature.geometry, sx, sy, height);
    if (!d) continue;
    paths.push(
      `<path data-id="${escapeAttr(p.id)}" data-slug="${escapeAttr(p.slug)}" data-name="${escapeAttr(p.name)}" d="${d}"/>`,
    );
  }

  const dots: string[] = [];
  const r = Math.max(width * 0.0035, 8);
  for (const feature of tiny.features) {
    if (!feature.geometry || !isPointGeometry(feature.geometry)) continue;
    const coords =
      feature.geometry.type === "Point"
        ? feature.geometry.coordinates
        : feature.geometry.coordinates[0];
    if (!coords) continue;
    const cx = round(coords[0] - sx);
    const cy = round(height - (coords[1] - sy));
    const p = feature.properties;
    dots.push(
      `<circle data-id="${escapeAttr(p.id)}" data-slug="${escapeAttr(p.slug)}" data-name="${escapeAttr(p.name)}" cx="${cx}" cy="${cy}" r="${round(r)}"/>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="World map (Robinson projection)">
  <title>World map</title>
  <desc>Static Robinson fallback used when WebGL2 is unavailable. Made with Natural Earth.</desc>
  <rect class="ocean" width="${vbW}" height="${vbH}"/>
  <g class="countries">${paths.join("")}</g>
  <g class="tiny">${dots.join("")}</g>
</svg>
`;
}
