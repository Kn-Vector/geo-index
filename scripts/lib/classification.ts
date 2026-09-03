import type { EntityClassification, PublicationTier } from "@geo-index/schema";

export type NonCoreMeta = {
  classification: EntityClassification;
  tier: PublicationTier;
  parentIsoAlpha3?: string;
  notes?: string;
};

/**
 * Classification for ISO 3166-1 codes that are not UN members.
 * Descriptive only — not a sovereignty claim.
 */
export const NON_CORE_BY_ISO2: Record<string, NonCoreMeta> = {
  // UN observers are applied in the generator as core, not via this table.
  HK: {
    classification: "sar",
    tier: "profiled-additional",
    parentIsoAlpha3: "CHN",
    notes: "Special Administrative Region of China.",
  },
  MO: {
    classification: "sar",
    tier: "profiled-additional",
    parentIsoAlpha3: "CHN",
    notes: "Special Administrative Region of China.",
  },
  CK: {
    classification: "associated-state",
    tier: "profiled-additional",
    parentIsoAlpha3: "NZL",
    notes: "State in free association with New Zealand.",
  },
  NU: {
    classification: "associated-state",
    tier: "profiled-additional",
    parentIsoAlpha3: "NZL",
    notes: "State in free association with New Zealand.",
  },
  EH: {
    classification: "special-status",
    tier: "profiled-additional",
    notes:
      "Disputed territory. Names and boundaries do not imply endorsement of any claim.",
  },
  TW: {
    classification: "special-status",
    tier: "profiled-additional",
    notes:
      "UN M49 statistical code 158. Not a UN member. Never labeled a UN member in this atlas.",
  },
  XK: {
    classification: "special-status",
    tier: "profiled-additional",
    notes:
      "UN Security Council resolution 1244 (1999). M49 statistical code 412. Not a UN member. ISO 3166-1 uses user-assigned XK/XKX; Natural Earth ADM0_A3 is KOS.",
  },

  PR: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "USA" },
  GU: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "USA" },
  VI: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "USA" },
  AS: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "USA" },
  MP: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "USA" },
  UM: { classification: "territory", tier: "index-only", parentIsoAlpha3: "USA" },

  GL: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "DNK" },
  FO: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "DNK" },

  BM: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  KY: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  VG: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  TC: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  AI: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  MS: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  GI: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  FK: {
    classification: "dependency",
    tier: "profiled-additional",
    parentIsoAlpha3: "GBR",
    notes: "UN designation includes Malvinas. Disputed with Argentina.",
  },
  SH: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  PN: { classification: "dependency", tier: "index-only", parentIsoAlpha3: "GBR" },
  GS: { classification: "dependency", tier: "index-only", parentIsoAlpha3: "GBR" },
  IO: { classification: "dependency", tier: "index-only", parentIsoAlpha3: "GBR" },
  GG: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  JE: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },
  IM: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "GBR" },

  PF: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  NC: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  WF: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  BL: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  MF: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  PM: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "FRA" },
  GP: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "FRA",
    notes: "Overseas department of France.",
  },
  MQ: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "FRA",
    notes: "Overseas department of France.",
  },
  GF: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "FRA",
    notes: "Overseas department of France.",
  },
  RE: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "FRA",
    notes: "Overseas department of France.",
  },
  YT: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "FRA",
    notes: "Overseas department of France.",
  },
  TF: { classification: "territory", tier: "index-only", parentIsoAlpha3: "FRA" },

  AW: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "NLD" },
  CW: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "NLD" },
  SX: { classification: "dependency", tier: "profiled-additional", parentIsoAlpha3: "NLD" },
  BQ: {
    classification: "territory",
    tier: "profiled-additional",
    parentIsoAlpha3: "NLD",
    notes: "Caribbean Netherlands (Bonaire, Sint Eustatius and Saba).",
  },

  TK: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "NZL" },

  CX: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "AUS" },
  CC: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "AUS" },
  NF: { classification: "territory", tier: "profiled-additional", parentIsoAlpha3: "AUS" },
  HM: { classification: "territory", tier: "index-only", parentIsoAlpha3: "AUS" },

  AX: { classification: "statistical-area", tier: "profiled-additional", parentIsoAlpha3: "FIN" },
  SJ: { classification: "statistical-area", tier: "index-only", parentIsoAlpha3: "NOR" },
  BV: { classification: "territory", tier: "index-only", parentIsoAlpha3: "NOR" },
  AQ: { classification: "statistical-area", tier: "index-only" },
};

export const SLUG_OVERRIDES: Record<string, string> = {
  BHS: "bahamas",
  COD: "democratic-republic-of-the-congo",
  COG: "republic-of-the-congo",
  PRK: "north-korea",
  KOR: "south-korea",
  LAO: "laos",
  MDA: "moldova",
  RUS: "russia",
  SYR: "syria",
  IRN: "iran",
  BOL: "bolivia",
  VEN: "venezuela",
  VNM: "vietnam",
  TZA: "tanzania",
  GBR: "united-kingdom",
  USA: "united-states",
  ARE: "united-arab-emirates",
  FSM: "micronesia",
  BRN: "brunei",
  CIV: "cote-divoire",
  TUR: "turkiye",
  CZE: "czechia",
  MKD: "north-macedonia",
  MMR: "myanmar",
  TLS: "timor-leste",
  SWZ: "eswatini",
  CPV: "cabo-verde",
  PSE: "palestine",
  VAT: "holy-see",
  TWN: "taiwan",
  XKX: "kosovo",
  HKG: "hong-kong",
  MAC: "macau",
  NRU: "nauru",
  NLD: "netherlands",
  FLK: "falkland-islands",
  WLF: "wallis-and-futuna",
  VIR: "us-virgin-islands",
  VGB: "british-virgin-islands",
  SJM: "svalbard-and-jan-mayen",
  BES: "caribbean-netherlands",
  SXM: "sint-maarten",
  MAF: "saint-martin",
  BLM: "saint-barthelemy",
  SPM: "saint-pierre-and-miquelon",
  SHN: "saint-helena",
  CCK: "cocos-islands",
  CXR: "christmas-island",
  NFK: "norfolk-island",
  PCN: "pitcairn",
  SGS: "south-georgia",
  IOT: "british-indian-ocean-territory",
  UMI: "us-minor-outlying-islands",
  ATF: "french-southern-territories",
  HMD: "heard-island",
  BVT: "bouvet-island",
  ATA: "antarctica",
  GUM: "guam",
  PRI: "puerto-rico",
  GRL: "greenland",
  FRO: "faroe-islands",
  BMU: "bermuda",
  PYF: "french-polynesia",
  NCL: "new-caledonia",
  ESH: "western-sahara",
  COK: "cook-islands",
  NIU: "niue",
  ASM: "american-samoa",
  MNP: "northern-mariana-islands",
  CUW: "curacao",
  ABW: "aruba",
  ALA: "aland-islands",
  IMN: "isle-of-man",
  GGY: "guernsey",
  JEY: "jersey",
  GLP: "guadeloupe",
  MTQ: "martinique",
  GUF: "french-guiana",
  REU: "reunion",
  MYT: "mayotte",
};

/** UN Library short names that differ from M49 "country or area". */
export const UN_MEMBER_NAME_ALIASES: Record<string, string> = {
  "The Bahamas": "Bahamas",
  "United Kingdom": "United Kingdom of Great Britain and Northern Ireland",
  "United States": "United States of America",
};

/** Editorial common names when UN/ISO short names are overly formal. */
export const COMMON_NAME_OVERRIDES: Record<string, string> = {
  USA: "United States",
  GBR: "United Kingdom",
  RUS: "Russia",
  NLD: "Netherlands",
  NRU: "Nauru",
  HKG: "Hong Kong",
  MAC: "Macau",
  FSM: "Micronesia",
  BRN: "Brunei",
  COG: "Republic of the Congo",
  PSE: "Palestine",
  VAT: "Holy See",
  TWN: "Taiwan",
  XKX: "Kosovo",
  FLK: "Falkland Islands",
  WLF: "Wallis and Futuna",
  VIR: "U.S. Virgin Islands",
  SJM: "Svalbard and Jan Mayen",
  BES: "Caribbean Netherlands",
  SXM: "Sint Maarten",
  MAF: "Saint Martin",
  CCK: "Cocos Islands",
  UMI: "U.S. Minor Outlying Islands",
  LAO: "Laos",
  MDA: "Moldova",
  SYR: "Syria",
  IRN: "Iran",
  BOL: "Bolivia",
  VEN: "Venezuela",
  VNM: "Vietnam",
  TZA: "Tanzania",
  PRK: "North Korea",
  KOR: "South Korea",
  ARE: "United Arab Emirates",
};

export const TAIWAN_UN_DESIGNATION = "Taiwan, Province of China";
export const KOSOVO_M49 = "412";
export const TAIWAN_M49 = "158";
