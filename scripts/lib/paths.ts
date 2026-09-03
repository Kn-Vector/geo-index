import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const CATALOG_DIR = path.join(ROOT, "data/catalog");
export const RAW_WPP = path.join(ROOT, "data/raw/wpp");
export const RAW_WDI = path.join(ROOT, "data/raw/wdi");
export const RAW_HDR = path.join(ROOT, "data/raw/hdr");
export const RAW_UNESCO = path.join(ROOT, "data/raw/unesco");
export const RAW_ILO = path.join(ROOT, "data/raw/ilo");
export const RAW_IMF = path.join(ROOT, "data/raw/imf");
export const RAW_OWID = path.join(ROOT, "data/raw/owid");
export const NORMALIZED_DIR = path.join(ROOT, "data/normalized");
export const GENERATED_DIR = path.join(ROOT, "data/generated");
export const GENERATED_ENTITIES_DIR = path.join(GENERATED_DIR, "entities");

export const ENTITIES_YAML = path.join(CATALOG_DIR, "entities.yaml");
export const INDICATORS_YAML = path.join(CATALOG_DIR, "indicators.yaml");
export const PRECEDENCE_YAML = path.join(CATALOG_DIR, "precedence.yaml");
export const ETL_SOURCES_YAML = path.join(CATALOG_DIR, "etl-sources.yaml");

export const WPP_GZ = path.join(RAW_WPP, "WPP2024_Demographic_Indicators_Medium.csv.gz");
export const WPP_META = path.join(RAW_WPP, "fetch-meta.json");
export const WDI_EXTRACTED = path.join(RAW_WDI, "extracted");
export const WDI_META = path.join(RAW_WDI, "fetch-meta.json");
export const HDR_META = path.join(RAW_HDR, "fetch-meta.json");
export const UNESCO_META = path.join(RAW_UNESCO, "fetch-meta.json");
export const UNESCO_EXTRACTED = path.join(RAW_UNESCO, "extracted");
export const ILO_META = path.join(RAW_ILO, "fetch-meta.json");
export const IMF_META = path.join(RAW_IMF, "fetch-meta.json");
export const OWID_META = path.join(RAW_OWID, "fetch-meta.json");

export const MANIFEST_JSON = path.join(GENERATED_DIR, "manifest.json");
export const COVERAGE_JSON = path.join(GENERATED_DIR, "coverage.json");

export const USER_AGENT = "GeoIndex/0.1 (world atlas ETL; https://github.com/geo-index)";
