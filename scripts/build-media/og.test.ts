import { describe, expect, it } from "vitest";
import { buildOgSvg, escapeXml, renderOgPng } from "./og.ts";

describe("OG cards", () => {
  it("escapes names for SVG text", () => {
    expect(escapeXml(`São Tomé & Príncipe`)).toBe("São Tomé &amp; Príncipe");
  });

  it("builds a default card and a named card as PNG", () => {
    const def = renderOgPng(buildOgSvg(null));
    expect(def[0]).toBe(0x89);
    expect(def.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(def.length).toBeGreaterThan(2000);

    const named = renderOgPng(buildOgSvg({ id: "japan", commonName: "Japan", isoAlpha2: "JP" }));
    expect(named[0]).toBe(0x89);
    expect(named.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(named.length).toBeGreaterThan(2000);
  });
});
