import { describe, expect, it } from "vitest";
import { licenseAllowed } from "./commons.ts";

describe("Commons license allowlist", () => {
  it("accepts PD, CC0, BY, and BY-SA", () => {
    expect(licenseAllowed("CC BY 4.0")).toBe(true);
    expect(licenseAllowed("CC BY-SA 3.0")).toBe(true);
    expect(licenseAllowed("CC0")).toBe(true);
    expect(licenseAllowed("Public domain")).toBe(true);
  });

  it("rejects NC, ND, and unclear licenses", () => {
    expect(licenseAllowed("CC BY-NC 4.0")).toBe(false);
    expect(licenseAllowed("CC BY-ND 3.0")).toBe(false);
    expect(licenseAllowed("CC BY-NC-ND 4.0")).toBe(false);
    expect(licenseAllowed("")).toBe(false);
    expect(licenseAllowed("All rights reserved")).toBe(false);
  });
});
