# @geo-index/geo

MapLibre globe geometry pipeline.

```bash
pnpm geo:build
```

Downloads Natural Earth 5.1.1 (public domain; cached under `data/raw/natural-earth/`) and writes:

- `apps/web/public/geo/countries-50m.geojson` — 50m admin-0 polygons (lakes punched out when available)
- `apps/web/public/geo/tiny-countries.geojson` — 50m/10m points with enlarged hit targets in the style
- `apps/web/public/geo/disputed.geojson` — breakaway polygons + dashed dispute lines
- `apps/web/public/geo/world-robinson.svg` — WebGL2 fallback
- `apps/web/public/geo/index.json` — search/fly-to index
- `apps/web/public/geo/globe-style.json` — self-hosted MapLibre style (no token)

Join keys: `ADM0_A3` / `ISO_A3_EH` / `ISO_A3`, never English names. Palestine is `PSX` on the globe and `PSE` in ISO. South Sudan is `SDS` → `SSD`. Tiny states that collapse to points at 50m get circle hit targets of 24–44 px.

Made with Natural Earth.
