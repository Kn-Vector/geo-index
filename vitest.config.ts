import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/schema/src/**/*.test.ts",
      "packages/geo/src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
  },
});
