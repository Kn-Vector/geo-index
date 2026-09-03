# Geo Index

A static-first editorial world atlas. Country pages are documents, not dashboards — each figure sourced, dated, and allowed to be missing.

Site original code is MIT. Original editorial copy is CC BY 4.0. Upstream datasets keep their own licences.

## Run the site

`pnpm` may be missing from PATH. `npx pnpm@10.34.5` works.

```bash
npx pnpm@10.34.5 install
npx pnpm@10.34.5 data:fetch
npx pnpm@10.34.5 data:normalize
npx pnpm@10.34.5 data:validate
npx pnpm@10.34.5 geo:build
npx pnpm@10.34.5 media:build
npx pnpm@10.34.5 test
npx pnpm@10.34.5 dev
```

`pnpm dev` starts the Astro app at http://localhost:4321. Open `/countries/japan/` for a dense profile, `/countries/holy-see/` or `/countries/tuvalu/` for sparse ones, and `/?focus=japan` to fly the globe.

Production build:

```bash
npx pnpm@10.34.5 build
npx pnpm@10.34.5 --filter @geo-index/web preview
```

`pnpm build` writes PNG Open Graph cards, then `astro build`, then Pagefind indexes `apps/web/dist/`. Output is fully static HTML — no server. Site-wide search is the Pagefind UI in the header after a production build; `astro dev` keeps directory search at `/countries/`.

## Deploy (GitHub + Cloudflare)

The public site is a **Cloudflare Worker + Assets** app, same pattern as TenFold and UpBid.

- **Production:** [https://geo-index.goldenegg.workers.dev](https://geo-index.goldenegg.workers.dev)
- **Preview:** [https://geo-index-preview.goldenegg.workers.dev](https://geo-index-preview.goldenegg.workers.dev)
- **Pages production:** [https://geo-index-8gl.pages.dev](https://geo-index-8gl.pages.dev)
- **Pages preview:** [https://main.geo-index-8gl.pages.dev](https://main.geo-index-8gl.pages.dev)
- **Release zips:** [https://geo-index-releases.goldenegg.workers.dev](https://geo-index-releases.goldenegg.workers.dev)

### Branches

| Branch | Cloudflare | GitHub |
|---|---|---|
| `production` | Worker `geo-index` + Pages production | Versioned **Release** zips (sources, catalog, checksums, generated, geo, media) |
| `main`, `preview`, pull requests | Worker `geo-index-preview` + Pages preview | No release |

Local first deploy uses the logged-in Wrangler OAuth session (`pnpm deploy`). GitHub Actions redeploys when `CLOUDFLARE_API_TOKEN` is set (same token already on `grey-goose-press`). Account ID `0e7457e9e732a01a6039f7902c7a7a60`.

Build settings:

- Node **22**
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Output directory: `apps/web/dist`
- `SITE=https://geo-index.goldenegg.workers.dev`

Do not run `data:fetch` on every CI job. Checksums live in git; large WDI/WPP/WEO blobs are gitignored. Generated profiles, globe GeoJSON, flags, silhouettes, and photos are tracked so a pull build can compile the site.

UNDP compliance: any production deploy that publishes HDI must use the current HDR recalculated series (`pnpm data:fetch` + `data:normalize` when HDR releases).

### Releases

Every push to `production` runs `.github/workflows/production.yml` and publishes:

- `geo-index-sources-*.zip` — site source, Workers, catalogs (no generated data)
- `geo-index-catalog-*.zip` — entity/indicator catalog, themes, media manifest
- `geo-index-checksums-*.zip` — SHA-256 sidecars to reproduce `pnpm data:fetch`
- `geo-index-generated-*.zip` — per-country JSON, coverage, vintages
- `geo-index-geo-*.zip` — globe geometry, silhouettes, flags
- `geo-index-media-*.zip` — curated photographs

GitHub also attaches the usual source zip/tarball for the tag. The releases Worker (`GET /latest`, `GET /download/sources`) redirects to those assets.

```bash
npx pnpm@10.34.5 release:pack
npx pnpm@10.34.5 deploy
npx pnpm@10.34.5 deploy:preview
npx pnpm@10.34.5 deploy:pages
npx pnpm@10.34.5 deploy:releases
```

## Layout

```
apps/web/                 Astro 7 site (`output: 'static'`, Preact islands)
packages/schema/          Zod entity / observation / indicator types
packages/geo/             Globe geometry (Natural Earth 50m + tiny points)
data/catalog/             entities, indicators, precedence, geography notes
data/raw/                 checksums in git; large blobs gitignored
data/normalized/          observations
data/generated/           per-entity JSON, coverage, themes, media
data/media/manifest.yaml  curated Commons files (allowlist licences)
data/themes/overrides.yaml
scripts/fetch|normalize|validate|build-geo|build-media
```

## Commands

```bash
pnpm data:fetch       # recorded URLs, version pins, checksums
pnpm data:normalize   # observations + entity profiles
pnpm data:validate    # fail on missing core 195, NaN, 0-for-null, licence holes
pnpm geo:build        # globe GeoJSON + Robinson SVG fallback
pnpm media:build      # Commons photos, silhouettes, WCAG flag themes, PNG OG cards
pnpm test
pnpm dev
pnpm build            # OG PNGs + astro build + Pagefind index
```

Join statistics on `id`, ISO alpha-2/3, M49, or Natural Earth `ADM0_A3` — never on English names.

## Entity catalog

- **core:** 193 UN members + Holy See + State of Palestine
- **profiled-additional:** Taiwan, Kosovo, associated states, SARs, and data-rich territories
- **index-only:** remaining map units on the globe and in the directory

Taiwan is never labelled a UN member. Kosovo notes UNSCR 1244 and statistical M49 412.

## Accessibility and performance

The globe is not the only navigation: search, A–Z list, and `/countries/` are first-class. Skip links exist. Country pages do not load MapLibre. Photographs below the hero are `loading="lazy"`. Fonts are self-hosted Source Serif 4 and Source Sans 3 with `font-display: swap`.

## What this atlas will not do

No RestCountries. No IEA-EDGAR CO₂. No invented statistics. No live upstream calls in the browser.
