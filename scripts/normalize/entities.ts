import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  entityCatalogSchema,
  type Entity,
  type NativeName,
} from "@geo-index/schema";
import {
  COMMON_NAME_OVERRIDES,
  KOSOVO_M49,
  NON_CORE_BY_ISO2,
  SLUG_OVERRIDES,
  TAIWAN_M49,
  TAIWAN_UN_DESIGNATION,
  UN_MEMBER_NAME_ALIASES,
} from "../lib/classification.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ID_DIR = path.join(ROOT, "data/raw/identifiers");
const OUT_FILE = path.join(ROOT, "data/catalog/entities.yaml");

type M49Row = {
  regionCode?: string;
  regionName?: string;
  subregionCode?: string;
  subregionName?: string;
  intermediateRegionCode?: string;
  intermediateRegionName?: string;
  countryOrArea: string;
  m49: string;
  isoAlpha2?: string;
  isoAlpha3?: string;
  ldc?: boolean;
  lldc?: boolean;
  sids?: boolean;
};

type IsoEntry = {
  alpha_2: string;
  alpha_3: string;
  name: string;
  numeric: string;
  official_name?: string;
  common_name?: string;
};

type NeRow = {
  ADM0_A3: string;
  ADMIN?: string;
  NAME?: string;
  FORMAL_EN?: string;
  TYPE?: string;
  ISO_A2?: string;
  ISO_A2_EH?: string;
  ISO_A3?: string;
  ISO_A3_EH?: string;
  WIKIDATAID?: string;
  TINY?: string;
  [k: string]: string | undefined;
};

type WdBinding = {
  iso2?: { value: string };
  iso3?: { value: string };
  qid?: { value: string };
  native?: { value: string; "xml:lang"?: string };
  lang?: { value: string };
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function validA3(code: string | undefined): string | undefined {
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined;
}

function validA2(code: string | undefined): string | undefined {
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

function foldName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function region(code?: string, name?: string) {
  if (!code || !name || !/^\d{3}$/.test(code)) return undefined;
  return { m49: code, name };
}

function loadWikidata(file: string): {
  qidByIso2: Map<string, string>;
  namesByIso2: Map<string, NativeName[]>;
} {
  const qidByIso2 = new Map<string, string>();
  const namesByIso2 = new Map<string, NativeName[]>();
  if (!fs.existsSync(file)) {
    return { qidByIso2, namesByIso2 };
  }
  const raw = readJson<{ results?: { bindings?: WdBinding[] } }>(file);
  for (const b of raw.results?.bindings ?? []) {
    const iso2 = b.iso2?.value?.toUpperCase();
    if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) continue;
    if (b.qid?.value && !qidByIso2.has(iso2)) qidByIso2.set(iso2, b.qid.value);
    const value = b.native?.value?.trim();
    const language = (b.lang?.value || b.native?.["xml:lang"] || "").trim();
    if (!value || !language || language === "en") continue;
    const list = namesByIso2.get(iso2) ?? [];
    if (!list.some((n) => n.language === language && n.value === value)) {
      list.push({ value, language, source: "wikidata" });
      namesByIso2.set(iso2, list);
    }
  }
  for (const [iso2, list] of namesByIso2) {
    list.sort((a, b) => a.language.localeCompare(b.language));
    namesByIso2.set(iso2, list.slice(0, 12));
  }
  return { qidByIso2, namesByIso2 };
}

const NE_LANG_FIELDS: Array<[string, keyof NeRow]> = [
  ["ar", "NAME_AR"],
  ["bn", "NAME_BN"],
  ["de", "NAME_DE"],
  ["el", "NAME_EL"],
  ["es", "NAME_ES"],
  ["fa", "NAME_FA"],
  ["fr", "NAME_FR"],
  ["he", "NAME_HE"],
  ["hi", "NAME_HI"],
  ["ja", "NAME_JA"],
  ["ko", "NAME_KO"],
  ["ru", "NAME_RU"],
  ["uk", "NAME_UK"],
  ["ur", "NAME_UR"],
  ["vi", "NAME_VI"],
  ["zh", "NAME_ZH"],
  ["zh-Hant", "NAME_ZHT"],
];

function neLocalNames(row: NeRow | undefined, existing: NativeName[]): NativeName[] {
  if (!row) return existing;
  const out = [...existing];
  for (const [language, field] of NE_LANG_FIELDS) {
    const value = row[field]?.trim();
    if (!value) continue;
    if (out.some((n) => n.language === language || n.value === value)) continue;
    out.push({ value, language, source: "natural-earth" });
  }
  return out.slice(0, 12);
}

function indexNaturalEarth(rows: NeRow[]) {
  const byIso3 = new Map<string, NeRow>();
  const byIso2 = new Map<string, NeRow>();
  const byAdm0 = new Map<string, NeRow>();
  for (const row of rows) {
    const iso3 = validA3(row.ISO_A3_EH) || validA3(row.ISO_A3);
    const iso2 = validA2(row.ISO_A2_EH) || validA2(row.ISO_A2);
    if (iso3 && !byIso3.has(iso3)) byIso3.set(iso3, row);
    if (iso2 && !byIso2.has(iso2)) byIso2.set(iso2, row);
    byAdm0.set(row.ADM0_A3, row);
  }
  return { byIso3, byIso2, byAdm0 };
}

function findNe(
  index: ReturnType<typeof indexNaturalEarth>,
  iso3?: string,
  iso2?: string,
): NeRow | undefined {
  if (iso3 && index.byIso3.has(iso3)) return index.byIso3.get(iso3);
  if (iso2 && index.byIso2.has(iso2)) return index.byIso2.get(iso2);
  if (iso3 === "XKX") return index.byAdm0.get("KOS");
  return undefined;
}

export function buildEntities(): Entity[] {
  const m49Doc = readJson<{ rows: M49Row[] }>(path.join(ID_DIR, "un-m49.json"));
  const membersDoc = readJson<{ names: string[] }>(path.join(ID_DIR, "un-members.json"));
  const isoDoc = readJson<{ "3166-1": IsoEntry[] }>(path.join(ID_DIR, "iso-3166-1.json"));
  const neDoc = readJson<{ rows: NeRow[] }>(path.join(ID_DIR, "natural-earth-adm0.json"));
  const wd = loadWikidata(path.join(ID_DIR, "wikidata-native-names.json"));

  const isoBy3 = new Map(isoDoc["3166-1"].map((e) => [e.alpha_3, e]));
  const isoBy2 = new Map(isoDoc["3166-1"].map((e) => [e.alpha_2, e]));
  const m49ByName = new Map(m49Doc.rows.map((r) => [foldName(r.countryOrArea), r]));
  const ne = indexNaturalEarth(neDoc.rows);

  const memberM49 = new Set<string>();
  for (const name of membersDoc.names) {
    const mapped = foldName(UN_MEMBER_NAME_ALIASES[name] ?? name);
    const row = m49ByName.get(mapped);
    if (!row?.isoAlpha3) {
      throw new Error(`UN member not found in M49: ${name} (mapped: ${mapped})`);
    }
    memberM49.add(row.isoAlpha3);
  }
  if (memberM49.size !== 193) {
    throw new Error(`expected 193 UN member ISO3 codes, got ${memberM49.size}`);
  }

  const entities: Entity[] = [];
  const seenIso3 = new Set<string>();

  const pushFromM49 = (row: M49Row, extra?: Partial<Entity>) => {
    const iso3 = extra?.isoAlpha3 ?? row.isoAlpha3;
    const iso2 = extra?.isoAlpha2 ?? row.isoAlpha2;
    if (!iso3 || !iso2) return;
    if (seenIso3.has(iso3)) return;
    seenIso3.add(iso3);

    const iso = isoBy3.get(iso3) ?? isoBy2.get(iso2);
    const isMember = memberM49.has(iso3);
    const isObserver = iso3 === "VAT" || iso3 === "PSE";
    const nonCore = NON_CORE_BY_ISO2[iso2];

    let classification = extra?.classification;
    let tier = extra?.tier;
    let notes = extra?.notes ?? nonCore?.notes;
    let parentIsoAlpha3 = extra?.parentIsoAlpha3 ?? nonCore?.parentIsoAlpha3;

    if (isMember) {
      classification = "un-member";
      tier = "core";
      parentIsoAlpha3 = undefined;
    } else if (isObserver) {
      classification = "un-observer";
      tier = "core";
    } else if (nonCore) {
      classification = nonCore.classification;
      tier = nonCore.tier;
    } else {
      throw new Error(`No classification for ${iso2}/${iso3} (${row.countryOrArea})`);
    }

    const commonName =
      extra?.commonName ??
      COMMON_NAME_OVERRIDES[iso3] ??
      iso?.common_name ??
      row.countryOrArea;
    const officialName =
      extra?.officialName ?? iso?.official_name ?? iso?.name ?? row.countryOrArea;
    const id = extra?.id ?? SLUG_OVERRIDES[iso3] ?? slugify(commonName);
    const neRow = findNe(ne, iso3, iso2);
    const wdNames = extra?.nativeNames ?? (iso2 ? wd.namesByIso2.get(iso2) ?? [] : []);
    const nativeNames = wdNames.length ? wdNames : neLocalNames(neRow, []);

    const entity: Entity = {
      id,
      commonName,
      officialName,
      isoAlpha2: iso2,
      isoAlpha3: iso3,
      m49: extra?.m49 ?? row.m49,
      classification: classification!,
      tier: tier!,
    };
    if (extra?.unDesignation) entity.unDesignation = extra.unDesignation;
    if (nativeNames.length) entity.nativeNames = nativeNames;
    const regionObj = region(row.regionCode, row.regionName);
    const sub = region(row.subregionCode, row.subregionName);
    const mid = region(row.intermediateRegionCode, row.intermediateRegionName);
    if (regionObj) entity.region = regionObj;
    if (sub) entity.subregion = sub;
    if (mid) entity.intermediateRegion = mid;
    const qid = extra?.wikidataId ?? (iso2 ? wd.qidByIso2.get(iso2) : undefined) ?? neRow?.WIKIDATAID;
    if (qid && /^Q\d+$/.test(qid)) entity.wikidataId = qid;
    if (neRow) {
      entity.naturalEarth = {
        adm0A3: neRow.ADM0_A3,
        isoA3: validA3(neRow.ISO_A3),
        isoA3Eh: validA3(neRow.ISO_A3_EH),
        name: neRow.NAME,
        admin: neRow.ADMIN,
        wikidataId: neRow.WIKIDATAID && /^Q\d+$/.test(neRow.WIKIDATAID) ? neRow.WIKIDATAID : undefined,
        tiny: neRow.TINY ? neRow.TINY !== "0" && neRow.TINY !== "" : undefined,
        type: neRow.TYPE,
      };
    }
    if (parentIsoAlpha3) entity.parentIsoAlpha3 = parentIsoAlpha3;
    if (notes) entity.notes = notes;
    if (row.ldc) entity.ldc = true;
    if (row.lldc) entity.lldc = true;
    if (row.sids) entity.sids = true;
    entities.push(entity);
  };

  for (const row of m49Doc.rows) {
    if (!row.isoAlpha2 || !row.isoAlpha3) continue;
    if (row.isoAlpha3 === "PSE") {
      pushFromM49(row, {
        id: "palestine",
        commonName: "Palestine",
        officialName: "State of Palestine",
        classification: "un-observer",
        tier: "core",
        notes:
          "UN observer state. ISO PS/PSE, M49 275. Globe feature must be independently selectable.",
      });
      continue;
    }
    if (row.isoAlpha3 === "VAT") {
      pushFromM49(row, {
        id: "holy-see",
        commonName: "Holy See",
        officialName: "Holy See",
        classification: "un-observer",
        tier: "core",
        notes:
          "UN observer state. ISO VA/VAT, M49 336. Map geometry may use Vatican City.",
      });
      continue;
    }
    pushFromM49(row);
  }

  const taiwanIso = isoBy3.get("TWN");
  if (!taiwanIso) throw new Error("ISO 3166-1 is missing TW/TWN");
  pushFromM49(
    {
      countryOrArea: TAIWAN_UN_DESIGNATION,
      m49: TAIWAN_M49,
      isoAlpha2: "TW",
      isoAlpha3: "TWN",
      regionCode: "142",
      regionName: "Asia",
      subregionCode: "030",
      subregionName: "Eastern Asia",
    },
    {
      id: "taiwan",
      commonName: "Taiwan",
      officialName: taiwanIso.official_name ?? taiwanIso.name,
      unDesignation: TAIWAN_UN_DESIGNATION,
      classification: "special-status",
      tier: "profiled-additional",
      notes: NON_CORE_BY_ISO2.TW.notes,
    },
  );

  if (!seenIso3.has("XKX")) {
    const kosovoNe = ne.byAdm0.get("KOS");
    const wdNames = wd.namesByIso2.get("XK") ?? [];
    const nativeNames = wdNames.length ? wdNames : neLocalNames(kosovoNe, []);
    const kosovo: Entity = {
      id: "kosovo",
      commonName: "Kosovo",
      officialName: "Republic of Kosovo",
      isoAlpha2: "XK",
      isoAlpha3: "XKX",
      m49: KOSOVO_M49,
      region: { m49: "150", name: "Europe" },
      subregion: { m49: "039", name: "Southern Europe" },
      classification: "special-status",
      tier: "profiled-additional",
      notes: NON_CORE_BY_ISO2.XK.notes,
    };
    if (nativeNames.length) kosovo.nativeNames = nativeNames;
    const qid = wd.qidByIso2.get("XK") ?? kosovoNe?.WIKIDATAID;
    if (qid && /^Q\d+$/.test(qid)) kosovo.wikidataId = qid;
    if (kosovoNe) {
      kosovo.naturalEarth = {
        adm0A3: kosovoNe.ADM0_A3,
        isoA3: validA3(kosovoNe.ISO_A3),
        isoA3Eh: validA3(kosovoNe.ISO_A3_EH),
        name: kosovoNe.NAME,
        admin: kosovoNe.ADMIN,
        wikidataId:
          kosovoNe.WIKIDATAID && /^Q\d+$/.test(kosovoNe.WIKIDATAID)
            ? kosovoNe.WIKIDATAID
            : undefined,
        type: kosovoNe.TYPE,
      };
    }
    entities.push(kosovo);
    seenIso3.add("XKX");
  }

  const neOnly: Array<{ adm0: string; id: string; commonName: string; notes: string }> = [
    {
      adm0: "SOL",
      id: "somaliland",
      commonName: "Somaliland",
      notes: "Natural Earth map unit. Index-only; not an ISO 3166-1 assigned code.",
    },
    {
      adm0: "CYN",
      id: "northern-cyprus",
      commonName: "Northern Cyprus",
      notes: "Natural Earth map unit. Index-only; not an ISO 3166-1 assigned code.",
    },
    {
      adm0: "KAS",
      id: "siachen-glacier",
      commonName: "Siachen Glacier",
      notes: "Natural Earth indeterminate area. Index-only.",
    },
  ];
  for (const extra of neOnly) {
    const row = ne.byAdm0.get(extra.adm0);
    if (!row) continue;
    const nativeNames = neLocalNames(row, []);
    const entity: Entity = {
      id: extra.id,
      commonName: extra.commonName,
      officialName: row.ADMIN ?? extra.commonName,
      classification: "special-status",
      tier: "index-only",
      notes: extra.notes,
      naturalEarth: {
        adm0A3: row.ADM0_A3,
        name: row.NAME,
        admin: row.ADMIN,
        wikidataId: row.WIKIDATAID && /^Q\d+$/.test(row.WIKIDATAID) ? row.WIKIDATAID : undefined,
        type: row.TYPE,
      },
    };
    if (nativeNames.length) entity.nativeNames = nativeNames;
    if (row.WIKIDATAID && /^Q\d+$/.test(row.WIKIDATAID)) entity.wikidataId = row.WIKIDATAID;
    entities.push(entity);
  }

  entities.sort((a, b) => a.id.localeCompare(b.id));
  return entities;
}

export function writeCatalog(entities: Entity[]): void {
  const catalog = entityCatalogSchema.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "un-m49",
        label: "UN M49 standard country or area codes",
        url: "https://unstats.un.org/unsd/methodology/m49/overview/",
        license: "UN data — cite UNdata/UNSD",
      },
      {
        id: "un-members",
        label: "UN Dag Hammarskjöld Library current members (193)",
        url: "https://research.un.org/en/unmembers/currentmembers",
        license: "UN document",
      },
      {
        id: "iso-3166-1",
        label: "ISO 3166-1 (Debian iso-codes)",
        url: "https://salsa.debian.org/iso-codes-team/iso-codes",
        license: "LGPL-2.1-or-later (iso-codes packaging); ISO codes themselves are public identifiers",
      },
      {
        id: "natural-earth-5.1.1",
        label: "Natural Earth 5.1.1 admin-0 countries",
        url: "https://www.naturalearthdata.com/",
        license: "public domain",
      },
      {
        id: "wikidata",
        label: "Wikidata native names (P1705) and items (P297)",
        url: "https://query.wikidata.org/",
        license: "CC0",
      },
    ],
    entities,
  });

  const yaml = YAML.stringify(catalog, { lineWidth: 100, sortMapEntries: false });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, yaml, "utf8");
}

export function main(): void {
  const entities = buildEntities();
  writeCatalog(entities);
  const core = entities.filter((e) => e.tier === "core").length;
  const additional = entities.filter((e) => e.tier === "profiled-additional").length;
  const indexOnly = entities.filter((e) => e.tier === "index-only").length;
  console.log(
    `Normalized ${entities.length} entities (${core} core, ${additional} profiled-additional, ${indexOnly} index-only).`,
  );
}

const invoked = process.argv[1] && path.basename(process.argv[1]).startsWith("entities");
if (invoked) main();


