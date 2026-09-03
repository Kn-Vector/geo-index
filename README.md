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

The live site is a **Cloudflare Pages** project named `geo-index`. A small **Workers** script (`geo-index-releases`) exposes GitHub Release zips at the edge.

### Branches

| Branch | Cloudflare | GitHub |
|---|---|---|
| `production` | **Production** (`https://geo-index-8gl.pages.dev`) | Creates a versioned **Release** with catalog, checksum, generated-data, geo, and media zips |
| `main`, `preview`, pull requests | **Preview** (`*.geo-index-8gl.pages.dev`) | No release |

Cloudflare should **pull** `production` from GitHub (Workers & Pages → Create → Import a Git repository → this repo → production branch `production`). Preview deployments are created for other branches and PRs.

Until the GitHub app is connected, GitHub Actions can **push** builds with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets (Account ID `0e7457e9e732a01a6039f7902c7a7a60`). Create a token with *Account / Cloudflare Pages / Edit* and *Account / Workers Scripts / Edit*.

Build settings (Pages Git or Actions):

- Node **22**
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Output directory: `apps/web/dist`
- Environment variable `SITE=https://geo-index-8gl.pages.dev` on production (preview builds use `CF_PAGES_URL`)

Do not run `data:fetch` on every CI job. Checksums live in git; large WDI/WPP/WEO blobs are gitignored. Generated profiles, globe GeoJSON, flags, silhouettes, and photos are tracked so a pull build can compile the site.

UNDP compliance: any production deploy that publishes HDI must use the current HDR recalculated series (`pnpm data:fetch` + `data:normalize` when HDR releases).

### Releases

Every push to `production` runs `.github/workflows/production.yml` and publishes:

- `geo-index-catalog-*.zip` — entity/indicator catalog, themes, media manifest
- `geo-index-checksums-*.zip` — SHA-256 sidecars to reproduce `pnpm data:fetch`
- `geo-index-generated-*.zip` — per-country JSON, coverage, vintages
- `geo-index-geo-*.zip` — globe geometry, silhouettes, flags
- `geo-index-media-*.zip` — curated photographs

GitHub also attaches the usual source tarball. The releases Worker (`GET /latest`, `GET /download/generated`) redirects to those assets.

```bash
npx pnpm@10.34.5 release:pack
npx --yes wrangler@4 pages deploy apps/web/dist --project-name geo-index --branch production
npx --yes wrangler@4 deploy --config workers/releases/wrangler.toml
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
