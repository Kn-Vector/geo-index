import { describe, expect, it } from "vitest";
import type { Entity } from "@geo-index/schema";
import { buildEntityLookup, isNeTinyFlag, joinFeatureToEntity, validIso3 } from "./join.ts";

function entity(over: Partial<Entity> & Pick<Entity, "id" | "commonName">): Entity {
  return {
    officialName: over.officialName ?? over.commonName,
    classification: over.classification ?? "un-member",
    tier: over.tier ?? "core",
    ...over,
  };
}

const catalog: Entity[] = [
  entity({
    id: "palestine",
    commonName: "Palestine",
    isoAlpha2: "PS",
    isoAlpha3: "PSE",
    classification: "un-observer",
    naturalEarth: { adm0A3: "PSX", isoA3: "PSE", isoA3Eh: "PSE" },
  }),
  entity({
    id: "israel",
    commonName: "Israel",
    isoAlpha2: "IL",
    isoAlpha3: "ISR",
    naturalEarth: { adm0A3: "ISR", isoA3: "ISR", isoA3Eh: "ISR" },
  }),
  entity({
    id: "south-sudan",
    commonName: "South Sudan",
    isoAlpha2: "SS",
    isoAlpha3: "SSD",
    naturalEarth: { adm0A3: "SDS", isoA3: "SSD", isoA3Eh: "SSD" },
  }),
  entity({
    id: "france",
    commonName: "France",
    isoAlpha2: "FR",
    isoAlpha3: "FRA",
    naturalEarth: { adm0A3: "FRA", isoA3Eh: "FRA" },
  }),
  entity({
    id: "norway",
    commonName: "Norway",
    isoAlpha2: "NO",
    isoAlpha3: "NOR",
    naturalEarth: { adm0A3: "NOR", isoA3Eh: "NOR" },
  }),
  entity({
    id: "kosovo",
    commonName: "Kosovo",
    isoAlpha2: "XK",
    isoAlpha3: "XKX",
    classification: "special-status",
    tier: "profiled-additional",
    naturalEarth: { adm0A3: "KOS" },
  }),
];

describe("joinFeatureToEntity", () => {
  const lookup = buildEntityLookup(catalog);

  it("joins Palestine on Natural Earth PSX, not the English name", () => {
    const hit = joinFeatureToEntity(
      { ADM0_A3: "PSX", NAME: "Israel", ISO_A3: "PSE", ISO_A3_EH: "PSE" },
      lookup,
    );
    expect(hit?.id).toBe("palestine");
    expect(hit?.isoAlpha3).toBe("PSE");
  });

  it("does not join Palestine to Israel", () => {
    const israel = joinFeatureToEntity({ ADM0_A3: "ISR", ISO_A3: "ISR", NAME: "Israel" }, lookup);
    const palestine = joinFeatureToEntity({ ADM0_A3: "PSX", NAME: "Palestine" }, lookup);
    expect(israel?.id).toBe("israel");
    expect(palestine?.id).toBe("palestine");
    expect(israel?.id).not.toBe(palestine?.id);
  });

  it("joins South Sudan SDS (NE) to ISO SSD", () => {
    const hit = joinFeatureToEntity({ ADM0_A3: "SDS", ISO_A3: "SSD" }, lookup);
    expect(hit?.id).toBe("south-sudan");
    expect(hit?.isoAlpha3).toBe("SSD");
  });

  it("joins France/Norway via ISO_A3_EH when ISO_A3 is -99", () => {
    expect(joinFeatureToEntity({ ADM0_A3: "FRA", ISO_A3: "-99", ISO_A3_EH: "FRA" }, lookup)?.id).toBe(
      "france",
    );
    expect(joinFeatureToEntity({ ADM0_A3: "NOR", ISO_A3: "-99", ISO_A3_EH: "NOR" }, lookup)?.id).toBe(
      "norway",
    );
  });

  it("joins Kosovo on ADM0_A3 KOS, not a name", () => {
    expect(joinFeatureToEntity({ ADM0_A3: "KOS", NAME: "Kosovo" }, lookup)?.id).toBe("kosovo");
  });

  it("never matches on English names alone", () => {
    expect(joinFeatureToEntity({ NAME: "France", ADMIN: "France" }, lookup)).toBeUndefined();
  });
});

describe("validIso3 / TINY", () => {
  it("rejects Natural Earth -99 placeholders", () => {
    expect(validIso3("-99")).toBeUndefined();
    expect(validIso3("FRA")).toBe("FRA");
  });

  it("treats TINY -99 as not tiny", () => {
    expect(isNeTinyFlag("-99")).toBe(false);
    expect(isNeTinyFlag("0")).toBe(false);
    expect(isNeTinyFlag("3")).toBe(true);
    expect(isNeTinyFlag(5)).toBe(true);
  });
});
