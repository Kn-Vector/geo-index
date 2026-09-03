import { describe, expect, it } from "vitest";
import { observationSchema } from "@geo-index/schema";
import { validateObservation } from "./observations.ts";

const base = {
  indicatorId: "population",
  entityId: "japan",
  unit: "persons",
  period: { year: 2024 },
  status: "projection" as const,
  sourceId: "un-wpp",
  dataset: "WPP2024 Demographic Indicators Medium",
  originalIndicatorId: "TPopulation1Jan",
  retrievedAt: "2026-09-03T00:00:00.000Z",
  vintage: "2024-revision",
  licenseId: "cc-by-3.0-igo",
};

describe("validateObservation", () => {
  it("accepts a provenance-complete valued statistic", () => {
    const obs = observationSchema.parse({ ...base, value: 124_071_179 });
    expect(validateObservation(obs)).toEqual([]);
  });

  it("accepts null without coercing to zero", () => {
    const obs = observationSchema.parse({ ...base, entityId: "placeholder", value: null });
    expect(obs.value).toBeNull();
    expect(validateObservation(obs)).toEqual([]);
  });

  it("fails NaN and Infinity", () => {
    expect(validateObservation({ ...base, value: Number.NaN })).not.toEqual([]);
    expect(validateObservation({ ...base, value: Number.POSITIVE_INFINITY })).not.toEqual([]);
  });

  it("fails valued stats missing source or period", () => {
    const missingPeriod = validateObservation({
      ...base,
      value: 1,
      period: { year: undefined as unknown as number },
    });
    expect(missingPeriod.length).toBeGreaterThan(0);
    const missingSource = validateObservation({ ...base, value: 1, sourceId: "" });
    expect(missingSource.length).toBeGreaterThan(0);
  });

  it("fails implausible zero population (0-for-null)", () => {
    const errors = validateObservation({ ...base, value: 0 });
    expect(errors.some((e) => e.includes("0-for-null"))).toBe(true);
  });
});
