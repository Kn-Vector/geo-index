import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "./geojson.ts";
import type { GlobeFeatureProps } from "./join.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "..");
const COUNTRIES = path.join(ROOT, "apps/web/public/geo/countries-50m.geojson");

describe("generated globe countries", () => {
  it.skipIf(!fs.existsSync(COUNTRIES))("Palestine is independently selectable and not Israel", () => {
    const countries = JSON.parse(fs.readFileSync(COUNTRIES, "utf8")) as FeatureCollection<GlobeFeatureProps>;
    const palestine = countries.features.find((f) => f.properties.id === "palestine");
    const israel = countries.features.find((f) => f.properties.id === "israel");
    expect(palestine, "expected a palestine feature joined on ADM0_A3=PSX").toBeTruthy();
    expect(israel).toBeTruthy();
    expect(palestine!.properties.slug).toBe("palestine");
    expect(palestine!.properties.iso3).toBe("PSE");
    expect(JSON.stringify(palestine!.geometry)).not.toEqual(JSON.stringify(israel!.geometry));
  });

  it.skipIf(!fs.existsSync(COUNTRIES))("South Sudan joins SDS → SSD", () => {
    const countries = JSON.parse(fs.readFileSync(COUNTRIES, "utf8")) as FeatureCollection<GlobeFeatureProps>;
    const ss = countries.features.find((f) => f.properties.id === "south-sudan");
    expect(ss?.properties.iso3).toBe("SSD");
  });
});
