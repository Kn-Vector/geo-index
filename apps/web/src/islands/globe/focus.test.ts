import { describe, expect, it } from "vitest";
import { readFocusParam, resolveFocus, type GlobeIndexEntry } from "./types.ts";

const entities: GlobeIndexEntry[] = [
  { id: "japan", slug: "japan", name: "Japan", iso2: "JP", iso3: "JPN", tier: "core", classification: "un-member", tiny: true, center: [138, 36] },
  { id: "palestine", slug: "palestine", name: "Palestine", iso2: "PS", iso3: "PSE", tier: "core", classification: "un-observer", tiny: true, center: [35, 32] },
  { id: "taiwan", slug: "taiwan", name: "Taiwan", iso2: "TW", iso3: "TWN", tier: "profiled-additional", classification: "special-status", tiny: true, center: [121, 24] },
];

describe("globe focus query", () => {
  it("reads /?focus= from the query string", () => {
    expect(readFocusParam("?focus=japan")).toBe("japan");
    expect(readFocusParam("focus=palestine&x=1")).toBe("palestine");
    expect(readFocusParam("")).toBeUndefined();
  });

  it("resolves slug, id, and ISO codes", () => {
    expect(resolveFocus(entities, "japan")?.id).toBe("japan");
    expect(resolveFocus(entities, "PSE")?.id).toBe("palestine");
    expect(resolveFocus(entities, "tw")?.id).toBe("taiwan");
    expect(resolveFocus(entities, "missing")).toBeUndefined();
  });
});
