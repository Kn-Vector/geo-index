IMF World Economic Outlook entire-dataset Excel plus DataMapper JSON of the same vintage.

- Terms: IMF statistical data — attribution required; no intentional distortion; declare transformations; do not sell or redistribute the raw file as a product.
- The `.xlsx` is gitignored. SHA256 sidecars stay in git.
- Forecast years are marked `projection` (Estimates Start After, else estimateLastYear).

Refresh: `pnpm data:fetch` then `pnpm data:normalize` then `pnpm data:validate`.
