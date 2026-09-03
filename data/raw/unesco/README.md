UNESCO UIS Bulk Data Download Service snapshots. CC BY-SA 3.0 IGO.

Binaries and extracted CSV are gitignored. Checksums, this README, and LICENSE stay in git.

- OPRI.zip / SDG.zip: February 2026 BDDS archives from https://download.uis.unesco.org/bdds/202602/
- Join: COUNTRY_ID / geoUnit = ISO alpha-3. Never English names.
- License isolation: ShareAlike applies only to files in this directory. The site MIT license is unchanged.

Refresh: `pnpm data:fetch` then `pnpm data:normalize` then `pnpm data:validate`.
Pass `--force` to re-download and rewrite checksums.
