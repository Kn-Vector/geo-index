import type { Entity } from "@geo-index/schema";

export type EntityLookup = {
  byAdm0: Map<string, Entity>;
  byIso3: Map<string, Entity>;
};

const ISO3 = /^[A-Z]{3}$/;

export function validIso3(code: unknown): string | undefined {
  if (typeof code !== "string") return undefined;
  const trimmed = code.trim().toUpperCase();
  return ISO3.test(trimmed) ? trimmed : undefined;
}

/** Natural Earth TINY is a positive rank; -99 / 0 / empty means “not tiny”. */
export function isNeTinyFlag(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function buildEntityLookup(entities: Entity[]): EntityLookup {
  const byAdm0 = new Map<string, Entity>();
  const byIso3 = new Map<string, Entity>();
  for (const entity of entities) {
    const adm0 = entity.naturalEarth?.adm0A3?.trim();
    if (adm0) byAdm0.set(adm0.toUpperCase(), entity);
    if (entity.isoAlpha3) byIso3.set(entity.isoAlpha3, entity);
  }
  return { byAdm0, byIso3 };
}

function firstString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Join a Natural Earth feature to a catalog entity.
 * Order: ADM0_A3 → ISO_A3_EH → ISO_A3. Never English names.
 *
 * Special codes (handled via ADM0_A3 on the entity, not aliases here):
 * Palestine PSX, South Sudan SDS, Kosovo KOS, Western Sahara SAH.
 * France/Norway may have ISO_A3=-99 — ISO_A3_EH still matches.
 */
export function joinFeatureToEntity(
  props: Record<string, unknown>,
  lookup: EntityLookup,
): Entity | undefined {
  const adm0 = firstString(props, ["ADM0_A3", "adm0_a3", "BRK_A3", "brk_a3"]);
  if (adm0) {
    const hit = lookup.byAdm0.get(adm0.toUpperCase());
    if (hit) return hit;
  }

  const isoEh = validIso3(props.ISO_A3_EH ?? props.iso_a3_eh);
  if (isoEh) {
    const hit = lookup.byIso3.get(isoEh);
    if (hit) return hit;
  }

  const iso = validIso3(props.ISO_A3 ?? props.iso_a3);
  if (iso) {
    const hit = lookup.byIso3.get(iso);
    if (hit) return hit;
  }

  return undefined;
}

export type GlobeFeatureProps = {
  id: string;
  iso3?: string;
  iso2?: string;
  slug: string;
  name: string;
  tier: string;
  tiny?: boolean;
  disputeClass?: "breakaway" | "boundary" | "indeterminate";
};

export function entityToGlobeProps(
  entity: Entity,
  extra?: Partial<GlobeFeatureProps>,
): GlobeFeatureProps {
  const props: GlobeFeatureProps = {
    id: entity.id,
    slug: entity.id,
    name: entity.commonName,
    tier: entity.tier,
  };
  if (entity.isoAlpha3) props.iso3 = entity.isoAlpha3;
  if (entity.isoAlpha2) props.iso2 = entity.isoAlpha2;
  Object.assign(props, extra);
  return props;
}
