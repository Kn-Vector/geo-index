export const NATURAL_EARTH_VERSION = "5.1.1";

export const GLOBE_OUTPUT_DIR = "apps/web/public/geo";
export const GLOBE_ROOT_OUTPUT_DIR = "public/geo";
export const NE_RAW_DIR = "data/raw/natural-earth";
export const ENTITY_CATALOG = "data/catalog/entities.yaml";

/** Independently selectable overlays that may sit on top of a neighbour's fill. */
export const OVERLAY_ENTITY_IDS = [
  "palestine",
  "kosovo",
  "taiwan",
  "western-sahara",
] as const;

export const NACIS_BASE = "https://naciscdn.org/naturalearth";
export const S3_BASE = "https://naturalearth.s3.amazonaws.com";

export type NeAssetId =
  | "countries_lakes"
  | "countries"
  | "tiny_50m"
  | "tiny_10m"
  | "disputed_poly"
  | "disputed_lines";

export type NeAsset = {
  id: NeAssetId;
  /** Path under naciscdn.org/naturalearth/ — e.g. 50m/cultural/file.zip */
  cdnPath: string;
  /** Path under naturalearth.s3.amazonaws.com/ — e.g. 50m_cultural/file.zip */
  s3Path: string;
  required: boolean;
};

function asset(id: NeAssetId, folder: string, file: string, required: boolean): NeAsset {
  const [scale, theme] = folder.split("_") as [string, string];
  return {
    id,
    cdnPath: `${scale}/${theme}/${file}`,
    s3Path: `${folder}/${file}`,
    required,
  };
}

export const NE_ASSETS: NeAsset[] = [
  asset("countries_lakes", "50m_cultural", "ne_50m_admin_0_countries_lakes.zip", false),
  asset("countries", "50m_cultural", "ne_50m_admin_0_countries.zip", true),
  asset("tiny_50m", "50m_cultural", "ne_50m_admin_0_tiny_countries.zip", true),
  asset("tiny_10m", "10m_cultural", "ne_10m_admin_0_tiny_countries.zip", false),
  asset("disputed_poly", "50m_cultural", "ne_50m_admin_0_breakaway_disputed_areas.zip", true),
  asset("disputed_lines", "50m_cultural", "ne_50m_admin_0_boundary_lines_disputed_areas.zip", true),
];

export const FETCH_USER_AGENT =
  "Geo-Index/0.1 (atlas geometry build; Natural Earth public domain)";
