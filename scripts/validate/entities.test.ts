import { describe, expect, it } from "vitest";
import type { Entity } from "@geo-index/schema";
import { loadCatalog, validateEntities } from "./entities.ts";

function member(over: Partial<Entity> & Pick<Entity, "id" | "isoAlpha3">): Entity {
  return {
    commonName: over.commonName ?? over.id,
    officialName: over.officialName ?? over.id,
    isoAlpha2: over.isoAlpha2 ?? (over.isoAlpha3?.slice(0, 2) as string),
    classification: "un-member",
    tier: "core",
    ...over,
  };
}

describe("validateEntities", () => {
  it("fails when the core 195 are incomplete", () => {
    const errors = validateEntities([
      member({ id: "japan", isoAlpha3: "JPN", isoAlpha2: "JP" }),
    ]);
    expect(errors.some((e) => e.includes("195"))).toBe(true);
  });

  it("fails on duplicate slugs", () => {
    const errors = validateEntities([
      member({ id: "congo", isoAlpha3: "COG", isoAlpha2: "CG" }),
      member({ id: "congo", isoAlpha3: "COD", isoAlpha2: "CD" }),
    ]);
    expect(errors.some((e) => e.includes("duplicate slug"))).toBe(true);
  });

  it("fails when a core country lacks ISO3", () => {
    const errors = validateEntities([
      {
        id: "mystery",
        commonName: "Mystery",
        officialName: "Mystery",
        classification: "un-member",
        tier: "core",
      },
    ]);
    expect(errors.some((e) => e.includes("missing ISO alpha-3"))).toBe(true);
  });
});

describe("data/catalog/entities.yaml", () => {
  it("passes the crosswalk contract", () => {
    const catalog = loadCatalog();
    expect(validateEntities(catalog.entities)).toEqual([]);
    expect(catalog.entities.filter((e) => e.tier === "core")).toHaveLength(195);
  });
});
