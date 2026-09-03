import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

export default defineConfig({
  output: "static",
  site:
    process.env.CF_PAGES_URL ??
    process.env.SITE ??
    "https://geo-index.goldenegg.workers.dev",
  integrations: [preact()],
  trailingSlash: "always",
});
