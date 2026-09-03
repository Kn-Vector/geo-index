/**
 * Normalize raw snapshots into the canonical observation + entity catalogs.
 * Entity YAML is not rewritten here (use pnpm crosswalk:build).
 */
import { normalizeObservations } from "./observations.ts";

await normalizeObservations();
