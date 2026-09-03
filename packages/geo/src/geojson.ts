export type Position = [number, number] | [number, number, number];

export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "MultiPoint"; coordinates: Position[] }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] }
  | { type: "GeometryCollection"; geometries: Geometry[] };

export type Feature<P extends Record<string, unknown> = Record<string, unknown>> = {
  type: "Feature";
  id?: string | number;
  properties: P;
  geometry: Geometry | null;
};

export type FeatureCollection<P extends Record<string, unknown> = Record<string, unknown>> = {
  type: "FeatureCollection";
  features: Feature<P>[];
};

export function isPointGeometry(geom: Geometry | null): boolean {
  return geom?.type === "Point" || geom?.type === "MultiPoint";
}

export function isPolygonGeometry(geom: Geometry | null): boolean {
  return geom?.type === "Polygon" || geom?.type === "MultiPolygon";
}

export function isLineGeometry(geom: Geometry | null): boolean {
  return geom?.type === "LineString" || geom?.type === "MultiLineString";
}

function collectPositions(geom: Geometry | null, out: Position[]): void {
  if (!geom) return;
  switch (geom.type) {
    case "Point":
      out.push(geom.coordinates);
      break;
    case "MultiPoint":
    case "LineString":
      out.push(...geom.coordinates);
      break;
    case "MultiLineString":
    case "Polygon":
      for (const ring of geom.coordinates) out.push(...ring);
      break;
    case "MultiPolygon":
      for (const poly of geom.coordinates) for (const ring of poly) out.push(...ring);
      break;
    case "GeometryCollection":
      for (const g of geom.geometries) collectPositions(g, out);
      break;
  }
}

function ringArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

function largestPolygonRings(geom: Geometry): Position[][] | undefined {
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type !== "MultiPolygon" || geom.coordinates.length === 0) return undefined;
  let best = geom.coordinates[0];
  let bestArea = Math.abs(ringArea(best[0] ?? []));
  for (let i = 1; i < geom.coordinates.length; i++) {
    const area = Math.abs(ringArea(geom.coordinates[i][0] ?? []));
    if (area > bestArea) {
      best = geom.coordinates[i];
      bestArea = area;
    }
  }
  return best;
}

/** Approximate square-degree area of the largest polygon (for tiny-state detection). */
export function largestPolygonAreaDeg2(geom: Geometry | null): number {
  if (!geom) return 0;
  const rings = largestPolygonRings(geom);
  if (!rings?.[0] || rings[0].length < 4) return 0;
  return Math.abs(ringArea(rings[0]));
}

/**
 * Fly-to / label point. Uses the largest polygon so overseas fragments
 * (France, Chile, …) do not pull the camera into the ocean. Longitudes
 * unwrap across the antimeridian.
 */
export function featureCenter(geom: Geometry | null): [number, number] {
  if (!geom) return [0, 0];
  if (geom.type === "Point") {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  if (geom.type === "MultiPoint") {
    const first = geom.coordinates[0];
    return first ? [first[0], first[1]] : [0, 0];
  }

  const rings = isPolygonGeometry(geom) ? largestPolygonRings(geom) : undefined;
  const pts: Position[] = [];
  if (rings?.[0]) pts.push(...rings[0]);
  else collectPositions(geom, pts);
  if (pts.length === 0) return [0, 0];

  const origin = pts[0][0];
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of pts) {
    let x = lng;
    while (x - origin > 180) x -= 360;
    while (x - origin < -180) x += 360;
    sx += x;
    sy += lat;
  }
  let lng = sx / pts.length;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return [lng, sy / pts.length];
}

export function asProps(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function emptyCollection<P extends Record<string, unknown>>(): FeatureCollection<P> {
  return { type: "FeatureCollection", features: [] };
}
