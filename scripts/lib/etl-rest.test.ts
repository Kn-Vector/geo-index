import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadIndicators, loadPrecedence, sourceOrder } from "../lib/catalogs.ts";
import { parseNumericCell } from "../lib/values.ts";
import { ROOT } from "../lib/paths.ts";

describe("etl-rest catalog", () => {
  it("prefers ILO modelled estimates over WDI for unemployment", () => {
    const order = sourceOrder(loadPrecedence(), "unemployment");
    expect(order?.[0]).toBe("ilo-stat");
    expect(order).toContain("world-bank-wdi");
  });

  it("keeps UIS ShareAlike snapshots isolated with their own LICENSE", () => {
    const license = path.join(ROOT, "data/raw/unesco/LICENSE");
    expect(fs.existsSync(license)).toBe(true);
    const text = fs.readFileSync(license, "utf8");
    expect(text).toMatch(/CC BY-SA 3.0 IGO/i);
    expect(text).toMatch(/do not apply to original Geo Index source code/i);
  });

  it("maps UIS and HDR education codes without inventing values", () => {
    const catalog = loadIndicators();
    const mys = catalog.indicators.find((i) => i.id === "mean-years-schooling");
    expect(mys?.preferredSource).toBe("unesco-uis");
    expect(mys?.sourceIndicatorId).toBe("MYS.1T8.AG25T99");
    expect(mys?.fallbacks.some((f) => f.sourceId === "undp-hdr" && f.sourceIndicatorId === "mys")).toBe(true);
    expect(parseNumericCell("")).toBeNull();
  });

  it("marks IMF forecast indicators as projection-capable", () => {
    const catalog = loadIndicators();
    expect(catalog.indicators.find((i) => i.id === "inflation-cpi")?.projectionPossible).toBe(true);
    expect(catalog.indicators.find((i) => i.id === "fiscal-balance-pct-gdp")?.preferredSource).toBe("imf-weo");
    expect(catalog.indicators.find((i) => i.id === "co2-emissions")?.preferredSource).toBe("owid-co2");
  });
});
