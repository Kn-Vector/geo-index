/**
 * Validate generated catalogs. Fails CI if the core 195 are incomplete,
 * slugs collide, observations are NaN/0-for-null, or valued stats lack provenance.
 */
import { main as validateEntities } from "./entities.ts";
import { main as validateObservations } from "./observations.ts";

validateEntities();
if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
validateObservations();
