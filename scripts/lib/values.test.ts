import { describe, expect, it } from "vitest";
import { parseNumericCell, scaleWppValue, wppStatus } from "./values.ts";
import { parseCsvLine } from "./csv.ts";
import { buildEntityIndex, resolveEntity } from "./join.ts";
import type { Entity } from "@geo-index/schema";

describe("parseNumericCell", () => {
  it("keeps missing cells as null and does not coerce them to 0", () => {
    expect(parseNumericCell("")).toBeNull();
    expect(parseNumericCell("..")).toBeNull();
    expect(parseNumericCell("NA")).toBeNull();
    expect(parseNumericCell(undefined)).toBeNull();
  });

  it("preserves a real zero", () => {
    expect(parseNumericCell("0")).toBe(0);
    expect(parseNumericCell("0.0")).toBe(0);
  });

  it("rejects NaN/Infinity tokens as null", () => {
    expect(parseNumericCell("NaN")).toBeNull();
    expect(parseNumericCell("Infinity")).toBeNull();
  });
});

describe("WPP scaling and status", () => {
  it("converts thousands to persons", () => {
    expect(scaleWppValue("TPopulation1Jan", 124071.179)).toBeCloseTo(124071179, 3);
    expect(scaleWppValue("LEx", 84.852)).toBe(84.852);
  });

  it("marks 2024+ as projection", () => {
    expect(wppStatus(2023, 2023)).toBe("estimate");
    expect(wppStatus(2024, 2023)).toBe("projection");
    expect(wppStatus(2026, 2023)).toBe("projection");
  });
});

describe("csv", () => {
  it("parses quoted commas", () => {
    expect(parseCsvLine('"Aruba","ABW","GDP (current US$)"')).toEqual([
      "Aruba",
      "ABW",
      "GDP (current US$)",
    ]);
  });
});

describe("join keys", () => {
  const entities: Entity[] = [
    {
      id: "palestine",
      commonName: "State of Palestine",
      officialName: "State of Palestine",
      isoAlpha2: "PS",
      isoAlpha3: "PSE",
      m49: "275",
      classification: "un-observer",
      tier: "core",
    },
    {
      id: "taiwan",
      commonName: "Taiwan",
      officialName: "Taiwan",
      unDesignation: "Taiwan, Province of China",
      isoAlpha2: "TW",
      isoAlpha3: "TWN",
      m49: "158",
      classification: "special-status",
      tier: "profiled-additional",
    },
    {
      id: "kosovo",
      commonName: "Kosovo",
      officialName: "Kosovo",
      isoAlpha2: "XK",
      isoAlpha3: "XKX",
      m49: "412",
      classification: "special-status",
      tier: "profiled-additional",
    },
  ];
  const index = buildEntityIndex(entities);

  it("joins on ISO3 / M49, never names", () => {
    expect(resolveEntity(index, { iso3: "PSE" })?.id).toBe("palestine");
    expect(resolveEntity(index, { m49: "275" })?.id).toBe("palestine");
    expect(resolveEntity(index, { iso3: "TWN", m49: "158" })?.id).toBe("taiwan");
    expect(resolveEntity(index, { iso3: "XKX", m49: "412" })?.id).toBe("kosovo");
    expect(resolveEntity(index, { iso3: "PSX" })).toBeUndefined();
  });
});
