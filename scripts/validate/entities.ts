import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  entityCatalogSchema,
  type Entity,
  type EntityCatalog,
} from "@geo-index/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = path.join(ROOT, "data/catalog/entities.yaml");

const REQUIRED_CORE_ISO3 = {
  PSE: { iso2: "PS", m49: "275", classification: "un-observer", id: "palestine" },
  VAT: { iso2: "VA", m49: "336", classification: "un-observer", id: "holy-see" },
} as const;

const REQUIRED_ADDITIONAL = {
  TWN: {
    id: "taiwan",
    commonName: "Taiwan",
    unDesignation: "Taiwan, Province of China",
    m49: "158",
    classification: "special-status",
  },
  XKX: {
    id: "kosovo",
    classification: "special-status",
    m49: "412",
    noteIncludes: "1244",
  },
  COK: { id: "cook-islands" },
  NIU: { id: "niue" },
  HKG: { id: "hong-kong" },
  MAC: { id: "macau" },
  PRI: { id: "puerto-rico" },
  GRL: { id: "greenland" },
  FRO: { id: "faroe-islands" },
  GUM: { id: "guam" },
  BMU: { id: "bermuda" },
  PYF: { id: "french-polynesia" },
  NCL: { id: "new-caledonia" },
  ESH: { id: "western-sahara" },
} as const;

export function loadCatalog(file = CATALOG): EntityCatalog {
  const raw = YAML.parse(fs.readFileSync(file, "utf8"));
  return entityCatalogSchema.parse(raw);
}

export type { Entity };

export function validateEntities(entities: Entity[]): string[] {
  const errors: string[] = [];
  const core = entities.filter((e) => e.tier === "core");
  const members = core.filter((e) => e.classification === "un-member");
  const observers = core.filter((e) => e.classification === "un-observer");

  if (core.length !== 195) {
    errors.push(`core tier must be 195 (193 members + 2 observers); got ${core.length}`);
  }
  if (members.length !== 193) {
    errors.push(`un-member count must be 193; got ${members.length}`);
  }
  if (observers.length !== 2) {
    errors.push(`un-observer count must be 2; got ${observers.length}`);
  }

  const slugs = new Map<string, Entity>();
  const iso3s = new Map<string, Entity>();
  for (const entity of entities) {
    if (slugs.has(entity.id)) {
      errors.push(`duplicate slug ${entity.id} (${slugs.get(entity.id)?.commonName} and ${entity.commonName})`);
    } else {
      slugs.set(entity.id, entity);
    }
    if (entity.isoAlpha3) {
      if (iso3s.has(entity.isoAlpha3)) {
        errors.push(
          `duplicate isoAlpha3 ${entity.isoAlpha3} (${iso3s.get(entity.isoAlpha3)?.id} and ${entity.id})`,
        );
      } else {
        iso3s.set(entity.isoAlpha3, entity);
      }
    }
    if (entity.tier === "core" && !entity.isoAlpha3) {
      errors.push(`core entity ${entity.id} is missing ISO alpha-3`);
    }
    if (entity.classification === "un-member" && entity.tier !== "core") {
      errors.push(`${entity.id} is un-member but not core`);
    }
  }

  const taiwan = iso3s.get("TWN");
  if (!taiwan) errors.push("Taiwan (TWN) missing");
  else {
    if (taiwan.classification === "un-member") errors.push("Taiwan must never be labeled a UN member");
    if (taiwan.commonName !== "Taiwan") errors.push(`Taiwan commonName must be Taiwan; got ${taiwan.commonName}`);
    if (taiwan.unDesignation !== "Taiwan, Province of China") {
      errors.push("Taiwan unDesignation must be \"Taiwan, Province of China\"");
    }
    if (taiwan.m49 !== "158") errors.push("Taiwan m49 must be 158");
    if (taiwan.classification !== "special-status") errors.push("Taiwan classification must be special-status");
  }

  const kosovo = iso3s.get("XKX");
  if (!kosovo) errors.push("Kosovo (XKX) missing");
  else {
    if (kosovo.classification !== "special-status") errors.push("Kosovo classification must be special-status");
    if (kosovo.m49 !== "412") errors.push("Kosovo statistical m49 must be 412");
    if (!kosovo.notes?.includes("1244")) errors.push("Kosovo notes must mention UNSCR 1244");
  }

  for (const [iso3, expect] of Object.entries(REQUIRED_CORE_ISO3)) {
    const entity = iso3s.get(iso3);
    if (!entity) {
      errors.push(`missing core entity ${iso3}`);
      continue;
    }
    if (entity.isoAlpha2 !== expect.iso2) errors.push(`${iso3} isoAlpha2 must be ${expect.iso2}`);
    if (entity.m49 !== expect.m49) errors.push(`${iso3} m49 must be ${expect.m49}`);
    if (entity.classification !== expect.classification) {
      errors.push(`${iso3} classification must be ${expect.classification}`);
    }
    if (entity.tier !== "core") errors.push(`${iso3} must be core`);
    if (entity.id !== expect.id) errors.push(`${iso3} id must be ${expect.id}`);
  }

  for (const [iso3, expect] of Object.entries(REQUIRED_ADDITIONAL)) {
    const entity = iso3s.get(iso3);
    if (!entity) {
      errors.push(`missing required additional entity ${iso3}`);
      continue;
    }
    if (entity.id !== expect.id) errors.push(`${iso3} id must be ${expect.id}`);
    if (entity.tier === "core") errors.push(`${iso3} must not be core`);
  }

  return errors;
}

export function main(): void {
  const catalog = loadCatalog();
  const errors = validateEntities(catalog.entities);
  const core = catalog.entities.filter((e) => e.tier === "core").length;
  const additional = catalog.entities.filter((e) => e.tier === "profiled-additional").length;
  const indexOnly = catalog.entities.filter((e) => e.tier === "index-only").length;
  if (errors.length) {
    console.error("Entity catalog validation failed:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `OK ${catalog.entities.length} entities (${core} core, ${additional} profiled-additional, ${indexOnly} index-only)`,
  );
}

const invoked = process.argv[1] && path.basename(process.argv[1]).startsWith("entities");
if (invoked) main();
