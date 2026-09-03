import { describe, expect, it } from "vitest";
import type { IndicatorDefinition, Observation } from "@geo-index/schema";
import {
  EM_DASH,
  LATEST_UNAVAILABLE,
  NO_COMPARABLE_DATA,
  displayStat,
  formatNumber,
  shouldShowIndicator,
} from "./format.ts";

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

function obs(partial: Partial<Observation> & Pick<Observation, "indicatorId" | "value">): Observation {
  return {
    entityId: "japan",
    unit: "persons",
    period: { year: 2026 },
    status: "projection",
    sourceId: "un-wpp",
    dataset: "WPP2024 Demographic Indicators Medium",
    originalIndicatorId: "TPopulation1Jan",
    retrievedAt: "2026-09-03T00:00:00.000Z",
    vintage: "2024-revision",
    licenseId: "cc-by-3.0-igo",
    ...partial,
  };
}

describe("formatNumber", () => {
  it("formats compact population and money without inventing zeros", () => {
    expect(formatNumber(122_772_055, "compact-integer")).toBe("123 million");
    expect(formatNumber(4_435_162_999_976.94, "usd")).toBe("$4.44 trillion");
    expect(formatNumber(35_951.04, "usd")).toBe("$35,951");
    expect(formatNumber(85.1467, "1-decimal")).toBe("85.1");
    expect(formatNumber(0.925, "3-decimal")).toBe("0.925");
    expect(formatNumber(0, "usd")).toBe("$0");
    expect(formatNumber(0, "compact-integer")).toBe("0");
  });

  it("renders a published HDI value, never as 0.9", () => {
    const stat = displayStat(hdi, obs({ indicatorId: "hdi", value: 0.925, status: "actual", sourceId: "undp-hdr", unit: "index (0–1)" }));
    expect(stat.missing).toBe(false);
    expect(stat.text).toBe("0.925");
  });
});

describe("displayStat missing policy", () => {
  it("renders HDI with no observation as No comparable data, never 0", () => {
    const stat = displayStat(hdi, null);
    expect(stat.missing).toBe(true);
    expect(stat.text).toBe(NO_COMPARABLE_DATA);
    expect(stat.text).not.toBe("0");
    expect(stat.projection).toBe(false);
  });

  it("renders a null GDP observation as an em dash, never 0", () => {
    const stat = displayStat(gdp, obs({ indicatorId: "gdp", value: null, sourceId: "world-bank-wdi" }));
    expect(stat.missing).toBe(true);
    expect(stat.text).toBe(EM_DASH);
    expect(stat.text).not.toBe("0");
  });

  it("renders a true zero as zero", () => {
    const growth: IndicatorDefinition = { ...gdp, id: "gdp-growth", format: "1-decimal", missingPolicy: "em-dash" };
    const stat = displayStat(growth, obs({ indicatorId: "gdp-growth", value: 0, status: "actual" }));
    expect(stat.missing).toBe(false);
    expect(stat.text).toBe("0");
  });

  it("marks WPP 2026 population as a projection", () => {
    const stat = displayStat(pop, obs({ indicatorId: "population", value: 122_772_055 }));
    expect(stat.missing).toBe(false);
    expect(stat.projection).toBe(true);
    expect(stat.statusLabel).toBe("Projection");
    expect(stat.text).toBe("123 million");
  });

  it("uses Latest observation unavailable for a non-headline gap without a policy row", () => {
    const other: IndicatorDefinition = { ...gdp, id: "mean-years-school", headline: false, missingPolicy: "em-dash" };
    const stat = displayStat(other, null);
    expect(stat.text).toBe(LATEST_UNAVAILABLE);
  });
});

describe("shouldShowIndicator", () => {
  it("always shows headlines, including missing HDI", () => {
    expect(shouldShowIndicator(hdi, null)).toBe(true);
    expect(shouldShowIndicator(gdp, null)).toBe(true);
  });

  it("hides omit-section indicators when there is no value", () => {
    const elec: IndicatorDefinition = { ...gdp, id: "electricity-access", headline: false, missingPolicy: "omit-section" };
    expect(shouldShowIndicator(elec, null)).toBe(false);
    expect(shouldShowIndicator(elec, obs({ indicatorId: "electricity-access", value: 100 }))).toBe(true);
  });
});
