/**
 * Geometry pipeline for the MapLibre globe: Natural Earth 50m admin-0,
 * tiny-country points, disputed overlays, Robinson SVG fallback.
 */
export { NATURAL_EARTH_VERSION, GLOBE_OUTPUT_DIR } from "./constants.ts";
export { buildGlobeGeometry, type BuildResult, type GlobeIndex, type GlobeIndexEntry } from "./build.ts";
export { joinFeatureToEntity, buildEntityLookup, validIso3, isNeTinyFlag } from "./join.ts";
export { globeSources } from "./sources.ts";
export { globeStyleJson } from "./style.ts";
