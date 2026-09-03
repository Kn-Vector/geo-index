World Bank WDI allowlisted series. Binaries are gitignored; checksums stay in git.

The full `WDI_CSV.zip` is ~270 MB. Fetch downloads only the indicator codes declared in `data/catalog/indicators.yaml` as per-series CSV zips (`?downloadformat=csv`), then extracts them to `extracted/`.

- License: CC BY 4.0 (plus third-party exceptions in WDI metadata; this allowlist is core Bank series)
- Join: Country Code = ISO alpha-3 (`XKX` Kosovo, `TWN` Taiwan, `PSE` Palestine)

Refresh: `pnpm data:fetch` then `pnpm data:normalize` then `pnpm data:validate`.
Pass `--force` to re-download and rewrite checksums.
