import type { Entity } from "@geo-index/schema";

export type EntityIndex = {
  byId: Map<string, Entity>;
  byIso3: Map<string, Entity>;
  byIso2: Map<string, Entity>;
  byM49: Map<string, Entity>;
};

export function buildEntityIndex(entities: Entity[]): EntityIndex {
  const byId = new Map<string, Entity>();
  const byIso3 = new Map<string, Entity>();
  const byIso2 = new Map<string, Entity>();
  const byM49 = new Map<string, Entity>();
  for (const entity of entities) {
    byId.set(entity.id, entity);
    if (entity.isoAlpha3) byIso3.set(entity.isoAlpha3, entity);
    if (entity.isoAlpha2) byIso2.set(entity.isoAlpha2, entity);
    if (entity.m49) byM49.set(entity.m49, entity);
  }
  return { byId, byIso3, byIso2, byM49 };
}

/** Join on ISO3, then M49, then ISO2. Never English names. */
export function resolveEntity(
  index: EntityIndex,
  keys: { iso3?: string; iso2?: string; m49?: string },
): Entity | undefined {
  const iso3 = keys.iso3?.trim().toUpperCase();
  if (iso3 && /^[A-Z]{3}$/.test(iso3)) {
    const hit = index.byIso3.get(iso3);
    if (hit) return hit;
  }
  const m49 = keys.m49?.trim().padStart(3, "0");
  if (m49 && /^\d{3}$/.test(m49)) {
    const hit = index.byM49.get(m49);
    if (hit) return hit;
  }
  const iso2 = keys.iso2?.trim().toUpperCase();
  if (iso2 && /^[A-Z]{2}$/.test(iso2)) {
    const hit = index.byIso2.get(iso2);
    if (hit) return hit;
  }
  return undefined;
}

export function padM49(locId: string | number): string {
  return String(locId).trim().padStart(3, "0");
}
