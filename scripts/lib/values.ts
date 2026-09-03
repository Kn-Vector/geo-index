import type { ObservationStatus } from "@geo-index/schema";

const MISSING = new Set(["", "..", "...", "NA", "N/A", "n/a", "null", "NULL", "-", "—"]);

/**
 * Parse a source cell. Empty / sentinel missing values stay null.
 * Never coerce missing to 0. A literal 0 is kept as 0.
 */
export function parseNumericCell(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (MISSING.has(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isImplausibleZero(indicatorId: string, value: number): boolean {
  if (value !== 0) return false;
  return (
    indicatorId === "population" ||
    indicatorId === "population-july" ||
    indicatorId === "gdp" ||
    indicatorId === "gdp-per-capita" ||
    indicatorId === "gdp-ppp" ||
    indicatorId === "gdp-per-capita-ppp" ||
    indicatorId === "gni-per-capita" ||
    indicatorId === "life-expectancy" ||
    indicatorId === "life-expectancy-male" ||
    indicatorId === "life-expectancy-female" ||
    indicatorId === "land-area" ||
    indicatorId === "surface-area" ||
    indicatorId === "median-age" ||
    indicatorId === "hdi" ||
    indicatorId === "ihdi" ||
    indicatorId === "mean-years-schooling" ||
    indicatorId === "expected-years-schooling"
  );
}

export function wppStatus(year: number, estimateLastYear: number): ObservationStatus {
  return year <= estimateLastYear ? "estimate" : "projection";
}

/** WPP stock/flow counts are thousands of persons. */
export const WPP_THOUSANDS_COLUMNS = new Set([
  "TPopulation1Jan",
  "TPopulation1July",
  "TPopulationMale1July",
  "TPopulationFemale1July",
  "NatChange",
  "PopChange",
  "Births",
  "Births1519",
  "Deaths",
  "DeathsMale",
  "DeathsFemale",
  "InfantDeaths",
  "LBsurvivingAge1",
  "Under5Deaths",
  "NetMigrations",
]);

export function scaleWppValue(column: string, value: number): number {
  return WPP_THOUSANDS_COLUMNS.has(column) ? value * 1000 : value;
}
