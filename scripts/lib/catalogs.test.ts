import { describe, expect, it } from "vitest";
import { loadIndicators, wdiCodesFromCatalog, wppColumnsFromCatalog } from "./catalogs.ts";

describe("indicator catalog", () => {
  it("loads headline indicators and a WDI/WPP allowlist", () => {
    const catalog = loadIndicators();
    const ids = catalog.indicators.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([
      "population",
      "gdp",
      "gdp-per-capita",
      "hdi",
      "life-expectancy",
      "land-area",
    ]));
    const pop = catalog.indicators.find((i) => i.id === "population");
    expect(pop?.preferredSource).toBe("un-wpp");
    expect(pop?.sourceIndicatorId).toBe("TPopulation1Jan");
    const hdi = catalog.indicators.find((i) => i.id === "hdi");
    expect(hdi?.preferredSource).toBe("undp-hdr");
    const unemployment = catalog.indicators.find((i) => i.id === "unemployment");
    expect(unemployment?.preferredSource).toBe("ilo-stat");
    expect(ids).toEqual(expect.arrayContaining([
      "ihdi",
      "gdi",
      "gii",
      "mpi",
      "literacy-rate-adult",
      "mean-years-schooling",
      "expected-years-schooling",
      "labor-force-participation",
      "fiscal-balance-pct-gdp",
      "co2-emissions",
    ]));
    const wdi = wdiCodesFromCatalog(catalog.indicators);
    expect(wdi).toContain("NY.GDP.MKTP.CD");
    expect(wdi).not.toHaveLength(0);
    expect(wdi.length).toBeLessThan(80);
    expect(wppColumnsFromCatalog(catalog.indicators).has("TPopulation1Jan")).toBe(true);
  });
});
