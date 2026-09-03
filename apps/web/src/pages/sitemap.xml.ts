import type { APIRoute } from "astro";
import { loadEntities, loadIndicators, loadRegions } from "../lib/catalog.ts";

export const GET: APIRoute = ({ site }) => {
  const origin = site ? site.href.replace(/\/$/, "") : "";
  const urls = [
    "/",
    "/countries/",
    "/regions/",
    "/indicators/",
    "/compare/",
    "/sources/",
    "/methodology/",
    "/methodology/maps/",
    ...loadEntities().map((e) => `/countries/${e.id}/`),
    ...[...new Map(loadRegions().map((r) => [r.slug, r])).values()].map((r) => `/regions/${r.slug}/`),
    ...loadIndicators()
      .indicators.filter((i) => i.rankable)
      .map((i) => `/indicators/${i.id}/`),
  ];
  const unique = [...new Set(urls)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
