import { describe, expect, it } from "vitest";
import type { IndicatorDefinition, Observation } from "@geo-index/schema";
import { buildHeadlines, observationMap } from "./assemble.ts";
import { EM_DASH } from "./format.ts";

const gdp: IndicatorDefinition = {
  id: "gdp",
  label: "Gross domestic product",
  shortLabel: "GDP",
  unit: "current US$",
  topics: ["economy"],
  preferredSource: "world-bank-wdi",
  sourceIndicatorId: "NY.GDP.MKTP.CD",
  fallbacks: [],
  frequency: "annual",
  comparable: true,
  rankable: true,
  projectionPossible: false,
  format: "usd",
  missingPolicy: "em-dash",
  headline: true,
};

const hdi: IndicatorDefinition = {
  id: "hdi",
  label: "Human Development Index",
  shortLabel: "HDI",
  unit: "index (0–1)",
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
  headline: true,
};

const pop: IndicatorDefinition = {
  id: "population",
  label: "Population",
  shortLabel: "Population",
  unit: "persons",
  topics: ["people"],
  preferredSource: "un-wpp",
  sourceIndicatorId: "TPopulation1Jan",
  fallbacks: [],
  frequency: "annual",
  comparable: true,
  rankable: true,
  projectionPossible: true,
  format: "compact-integer",
  missingPolicy: "em-dash",
  headline: true,
};

describe("buildHeadlines", () => {
  it("omits missing GDP from the hero instead of showing 0", () => {
    const headlines = buildHeadlines([pop, gdp, hdi], new Map());
    expect(headlines.find((s) => s.id === "gdp")).toBeUndefined();
    expect(headlines.every((s) => s.text !== "0" && s.text !== "$0")).toBe(true);
    expect(headlines.every((s) => s.text !== EM_DASH)).toBe(true);
  });

  it("keeps a published HDI value", () => {
    const obs: Observation = {
      indicatorId: "hdi",
      entityId: "japan",
      value: 0.925,
      unit: "index (0–1)",
      period: { year: 2023 },
      status: "actual",
      sourceId: "undp-hdr",
      dataset: "HDR",
      originalIndicatorId: "hdi",
      retrievedAt: "2026-09-03T00:00:00.000Z",
      vintage: "hdr-2025",
      licenseId: "cc-by-3.0-igo",
    };
    const headlines = buildHeadlines([hdi], observationMap({
      entityId: "japan",
      commonName: "Japan",
      classification: "un-member",
      tier: "core",
      generatedAt: "2026-09-03T00:00:00.000Z",
      headlines: { population: null, gdp: null, gdpPerCapita: null, hdi: obs, lifeExpectancy: null, area: null },
      observations: [obs],
      alternates: [],
    }));
    expect(headlines.find((s) => s.id === "hdi")?.text).toBe("0.925");
  });
});
