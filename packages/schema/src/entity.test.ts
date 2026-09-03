import { describe, expect, it } from "vitest";
import {
  entitySchema,
  observationSchema,
  indicatorDefinitionSchema,
} from "./index.ts";

describe("entitySchema", () => {
  it("accepts a core UN member joined on ISO/M49, not names", () => {
    const japan = entitySchema.parse({
      id: "japan",
      commonName: "Japan",
      officialName: "Japan",
      isoAlpha2: "JP",
      isoAlpha3: "JPN",
      m49: "392",
      classification: "un-member",
      tier: "core",
      wikidataId: "Q17",
      naturalEarth: { adm0A3: "JPN", isoA3Eh: "JPN" },
    });
    expect(japan.isoAlpha3).toBe("JPN");
  });

  it("records Taiwan as special-status with UN designation 158", () => {
    const taiwan = entitySchema.parse({
      id: "taiwan",
      commonName: "Taiwan",
      officialName: "Taiwan, Province of China",
      unDesignation: "Taiwan, Province of China",
      isoAlpha2: "TW",
      isoAlpha3: "TWN",
      m49: "158",
      classification: "special-status",
      tier: "profiled-additional",
    });
    expect(taiwan.classification).not.toBe("un-member");
    expect(taiwan.m49).toBe("158");
  });

  it("rejects joining-key-shaped names used as ISO3", () => {
    expect(() =>
      entitySchema.parse({
        id: "japan",
        commonName: "Japan",
        officialName: "Japan",
        isoAlpha3: "JAPAN",
        classification: "un-member",
        tier: "core",
      }),
    ).toThrow();
  });
});

describe("observationSchema", () => {
  it("stores null values without coercing them to zero", () => {
    const obs = observationSchema.parse({
      indicatorId: "population",
      entityId: "holy-see",
      value: null,
      unit: "persons",
      period: { year: 2024 },
      status: "actual",
      sourceId: "un-wpp",
      dataset: "WPP2024",
      originalIndicatorId: "TPopulation1Jan",
      retrievedAt: "2026-09-02",
      vintage: "2024-revision",
      licenseId: "cc-by-3.0-igo",
    });
    expect(obs.value).toBeNull();
  });
});

describe("indicatorDefinitionSchema", () => {
  it("marks headline population as WPP-preferred", () => {
    const def = indicatorDefinitionSchema.parse({
      id: "population",
      label: "Population",
      shortLabel: "Pop.",
      unit: "persons",
      topics: ["people"],
      preferredSource: "un-wpp",
      sourceIndicatorId: "TPopulation1Jan",
      fallbacks: [{ sourceId: "world-bank-wdi", sourceIndicatorId: "SP.POP.TOTL" }],
      frequency: "annual",
      comparable: true,
      rankable: true,
      projectionPossible: true,
      format: "compact-integer",
      missingPolicy: "em-dash",
      headline: true,
    });
    expect(def.preferredSource).toBe("un-wpp");
  });
});
