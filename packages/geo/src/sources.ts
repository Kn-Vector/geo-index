import { GLOBE_OUTPUT_DIR } from "./constants.ts";

export function globeSources(): { polygons: string; tinyPoints: string; disputed: string } {
  return {
    polygons: `${GLOBE_OUTPUT_DIR}/countries-50m.geojson`,
    tinyPoints: `${GLOBE_OUTPUT_DIR}/tiny-countries.geojson`,
    disputed: `${GLOBE_OUTPUT_DIR}/disputed.geojson`,
  };
}
