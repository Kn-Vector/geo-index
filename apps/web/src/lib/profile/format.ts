import type {
  IndicatorDefinition,
  IndicatorFormat,
  MissingPolicy,
  Observation,
  ObservationStatus,
} from "@geo-index/schema";

export const EM_DASH = "—";
export const NO_COMPARABLE_DATA = "No comparable data";
export const LATEST_UNAVAILABLE = "Latest observation unavailable";

export type DisplayStat = {
  id: string;
  label: string;
  shortLabel: string;
  text: string;
  missing: boolean;
  missingKind?: "em-dash" | "no-comparable-data" | "unavailable";
  unit?: string;
  year?: number;
  sourceId?: string;
  sourceLabel?: string;
  status?: ObservationStatus;
  statusLabel?: string;
  projection: boolean;
  dataset?: string;
  vintage?: string;
  licenseId?: string;
  originalIndicatorId?: string;
  notes?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  "un-wpp": "UN WPP",
  "world-bank-wdi": "World Bank WDI",
  "undp-hdr": "UNDP HDR",
  "imf-weo": "IMF WEO",
  "unesco-uis": "UNESCO UIS",
  "ilo-stat": "ILOSTAT",
  "ilo-ilostat": "ILOSTAT",
  "owid-co2": "OWID / Global Carbon Project",
};

const SOURCE_FULL: Record<string, string> = {
  "un-wpp": "United Nations World Population Prospects",
  "world-bank-wdi": "World Bank World Development Indicators",
  "undp-hdr": "UNDP Human Development Report",
  "imf-weo": "IMF World Economic Outlook",
  "unesco-uis": "UNESCO Institute for Statistics",
  "ilo-stat": "ILOSTAT",
  "ilo-ilostat": "ILOSTAT",
  "owid-co2": "Our World in Data (Global Carbon Project)",
};

const LICENSE_LABELS: Record<string, string> = {
  "cc-by-3.0-igo": "CC BY 3.0 IGO",
  "cc-by-4.0": "CC BY 4.0",
  "cc-by-sa-3.0-igo": "CC BY-SA 3.0 IGO",
  "imf-data-terms": "IMF data terms",
};

export function sourceLabel(sourceId: string): string {
  return SOURCE_LABELS[sourceId] ?? sourceId;
}

export function sourceFullName(sourceId: string): string {
  return SOURCE_FULL[sourceId] ?? sourceId;
}

export function licenseLabel(licenseId: string): string {
  return LICENSE_LABELS[licenseId] ?? licenseId;
}

export function statusLabel(status: ObservationStatus): string {
  switch (status) {
    case "actual":
      return "Actual";
    case "estimate":
      return "Estimate";
    case "projection":
      return "Projection";
  }
}

export function missingText(policy: MissingPolicy): string {
  switch (policy) {
    case "em-dash":
      return EM_DASH;
    case "no-comparable-data":
      return NO_COMPARABLE_DATA;
    case "omit-section":
      return "";
  }
}

export function formatNumber(value: number, format: IndicatorFormat): string {
  if (value === 0) return formatZero(format);

  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";

  switch (format) {
    case "compact-integer":
      return sign + compactInteger(abs);
    case "1-decimal":
      return sign + new Intl.NumberFormat("en", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(abs);
    case "3-decimal":
      return sign + new Intl.NumberFormat("en", { maximumFractionDigits: 3, minimumFractionDigits: 3 }).format(abs);
    case "percent":
      return sign + new Intl.NumberFormat("en", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(abs) + "%";
    case "usd":
      return sign + "$" + compactMoney(abs);
    case "intl-dollar":
      return sign + "Int’l $" + compactMoney(abs);
  }
}

function formatZero(format: IndicatorFormat): string {
  switch (format) {
    case "percent":
      return "0%";
    case "usd":
      return "$0";
    case "intl-dollar":
      return "Int’l $0";
    default:
      return "0";
  }
}

function compactInteger(abs: number): string {
  if (abs >= 1_000_000_000_000) return trimFixed(abs / 1_000_000_000_000) + " trillion";
  if (abs >= 1_000_000_000) return trimFixed(abs / 1_000_000_000) + " billion";
  if (abs >= 1_000_000) return trimFixed(abs / 1_000_000) + " million";
  return new Intl.NumberFormat("en", { maximumFractionDigits: abs >= 100 ? 0 : 1 }).format(abs);
}

function compactMoney(abs: number): string {
  if (abs >= 1_000_000_000_000) return trimFixed(abs / 1_000_000_000_000) + " trillion";
  if (abs >= 1_000_000_000) return trimFixed(abs / 1_000_000_000) + " billion";
  if (abs >= 1_000_000) return trimFixed(abs / 1_000_000) + " million";
  return new Intl.NumberFormat("en", { maximumFractionDigits: abs >= 100 ? 0 : 2 }).format(abs);
}

function trimFixed(n: number): string {
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return new Intl.NumberFormat("en", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

export function formatVintage(vintage: string): string {
  const wdi = /^wdi-(\d{4})-(\d{2})-(\d{2})$/.exec(vintage);
  if (wdi) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = months[Number(wdi[2]) - 1] ?? wdi[2];
    return `${Number(wdi[3])} ${month} ${wdi[1]}`;
  }
  if (vintage === "2024-revision") return "2024 Revision";
  const tagged = /^(hdr|uis|ilo|weo|owid-co2|owid)-(\d{4})(?:-(\d{2}))?$/.exec(vintage);
  if (tagged) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const kind = tagged[1];
    const year = tagged[2];
    const month = tagged[3] ? months[Number(tagged[3]) - 1] : undefined;
    const label =
      kind === "hdr"
        ? "HDR"
        : kind === "uis"
          ? "UIS"
          : kind === "ilo"
            ? "ILOSTAT"
            : kind === "weo"
              ? "WEO"
              : "OWID CO₂";
    return month ? `${label} ${month} ${year}` : `${label} ${year}`;
  }
  return vintage;
}

export function unitSuffix(unit: string, format: IndicatorFormat): string | undefined {
  if (format === "percent" || format === "usd" || format === "intl-dollar") return undefined;
  if (unit === "persons") return undefined;
  return unit;
}

/**
 * Render an observation. `null` never becomes "0".
 * A true zero from the source is formatted as zero.
 */
export function displayStat(indicator: IndicatorDefinition, observation: Observation | null): DisplayStat {
  const base = {
    id: indicator.id,
    label: indicator.label,
    shortLabel: indicator.shortLabel,
  };

  if (!observation) {
    const text = indicator.missingPolicy === "no-comparable-data" ? NO_COMPARABLE_DATA : indicator.headline ? missingText(indicator.missingPolicy) || EM_DASH : LATEST_UNAVAILABLE;
    const missingKind =
      text === NO_COMPARABLE_DATA ? "no-comparable-data" : text === LATEST_UNAVAILABLE ? "unavailable" : "em-dash";
    return {
      ...base,
      text: text || EM_DASH,
      missing: true,
      missingKind,
      projection: false,
    };
  }

  if (observation.value == null) {
    const text = missingText(indicator.missingPolicy) || (indicator.missingPolicy === "no-comparable-data" ? NO_COMPARABLE_DATA : EM_DASH);
    return {
      ...base,
      text: text || EM_DASH,
      missing: true,
      missingKind: indicator.missingPolicy === "no-comparable-data" ? "no-comparable-data" : "em-dash",
      year: observation.period.year,
      sourceId: observation.sourceId,
      sourceLabel: sourceLabel(observation.sourceId),
      projection: false,
      dataset: observation.dataset,
      vintage: observation.vintage,
      licenseId: observation.licenseId,
      originalIndicatorId: observation.originalIndicatorId,
      notes: observation.notes,
    };
  }

  return {
    ...base,
    text: formatNumber(observation.value, indicator.format),
    missing: false,
    unit: unitSuffix(observation.unit, indicator.format),
    year: observation.period.year,
    sourceId: observation.sourceId,
    sourceLabel: sourceLabel(observation.sourceId),
    status: observation.status,
    statusLabel: statusLabel(observation.status),
    projection: observation.status === "projection",
    dataset: observation.dataset,
    vintage: observation.vintage,
    licenseId: observation.licenseId,
    originalIndicatorId: observation.originalIndicatorId,
    notes: observation.notes,
  };
}

export function shouldShowIndicator(indicator: IndicatorDefinition, observation: Observation | null): boolean {
  if (observation && observation.value != null) return true;
  if (observation && observation.value == null) return indicator.missingPolicy !== "omit-section";
  if (indicator.headline) return true;
  if (indicator.missingPolicy === "no-comparable-data") return true;
  return false;
}
