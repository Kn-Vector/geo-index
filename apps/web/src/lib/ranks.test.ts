import { describe, expect, it } from "vitest";
import { classificationLabel } from "./labels.ts";
import { sameYearRanks } from "./ranks.ts";
import type { EntityProfile, IndicatorDefinition } from "@geo-index/schema";

const hdi: IndicatorDefinition = {
  id: "hdi",
  label: "Human Development Index",
  shortLabel: "HDI",
  unit: "index",
  topics: ["development"],
  preferredSource: "undp-hdr",
  sourceIndicatorId: "hdi",
  fallbacks: [],
  frequency: "annual",
  comparable: true,
  rankable: true,
  projectionPossible: false,
  format: "3-decimal",
  missingPolicy: "no-comparable-data",
};

function profile(id: string, year: number, value: number): EntityProfile {
  return {
    entityId: id,
    commonName: id,
    classification: id === "taiwan" || id === "kosovo" ? "special-status" : "un-member",
    tier: "core",
    generatedAt: "2026-09-03T00:00:00.000Z",
    headlines: { population: null, gdp: null, gdpPerCapita: null, hdi: null, lifeExpectancy: null, area: null },
    observations: [
      {
        indicatorId: "hdi",
        entityId: id,
        value,
        unit: "index",
        period: { year },
        status: "actual",
        sourceId: "undp-hdr",
        dataset: "HDR",
        originalIndicatorId: "hdi",
        retrievedAt: "2026-09-03T00:00:00.000Z",
        vintage: "hdr-2025",
        licenseId: "cc-by-3.0-igo",
      },
    ],
    alternates: [],
  };
}

describe("same-year ranks", () => {
  it("ranks the majority year and treats ties as the same rank", () => {
    const table = sameYearRanks(hdi, [
      profile("japan", 2023, 0.925),
      profile("iceland", 2023, 0.959),
      profile("france", 2023, 0.91),
      profile("nigeria", 2022, 0.548),
    ]);
    expect(table?.year).toBe(2023);
    expect(table?.cohort).toBe(3);
    expect(table?.rows[0]?.entityId).toBe("iceland");
    expect(table?.rows[0]?.rank).toBe(1);
  });
});

describe("classification labels", () => {
  it("never calls Taiwan or Kosovo UN members", () => {
    expect(classificationLabel("special-status")).toBe("Special status");
    expect(classificationLabel("special-status")).not.toContain("UN member");
    expect(classificationLabel("un-observer")).toBe("UN observer");
  });
});
