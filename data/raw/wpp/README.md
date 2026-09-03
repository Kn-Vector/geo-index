WPP 2024 Revision bulk CSV (gzip). Binaries are gitignored; checksums stay in git.

- File: `WPP2024_Demographic_Indicators_Medium.csv.gz`
- URL: recorded in `data/catalog/etl-sources.yaml`
- License: CC BY 3.0 IGO
- Join: `ISO3_code`, then `LocID` padded to M49. Never `Location` names.
- LocTypeID `4` = country/area (237). Estimates through 2023; medium projections 2024–2100.

Refresh: `pnpm data:fetch` then `pnpm data:normalize` then `pnpm data:validate`.
