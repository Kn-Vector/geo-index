import type {
  DataManifest,
  Entity,
  EntityProfile,
  IndicatorDefinition,
  Observation,
} from "@geo-index/schema";
import { displayStat, formatVintage, shouldShowIndicator, sourceFullName, sourceLabel, type DisplayStat } from "./format.ts";
import { comparisonSentence } from "./compare.ts";
import { lineChartSvg, observationSeries, seriesTable, stackedAreaSvg } from "./charts.ts";

export type ProfileSectionId =
  | "overview"
  | "people"
  | "economy"
  | "development"
  | "health-education"
  | "environment"
  | "geography"
  | "government"
  | "sources";

export type ProfileSection = {
  id: ProfileSectionId;
  label: string;
};

export type ChartBlock = {
  svg: string;
  caption: string;
  source: string;
  rows: { year: string; value: string; status: string }[];
  valueLabel: string;
};

export type StatBlock = DisplayStat & {
  comparison?: string;
};

const SECTION_LABELS: Record<ProfileSectionId, string> = {
  overview: "Overview",
  people: "People",
  economy: "Economy",
  development: "Development",
  "health-education": "Health and education",
  environment: "Environment",
  geography: "Geography",
  government: "Government",
  sources: "Sources",
};

const HEADLINE_IDS = ["population", "gdp", "gdp-per-capita", "hdi", "life-expectancy", "land-area"] as const;

function topicSection(topics: IndicatorDefinition["topics"]): ProfileSectionId | null {
  if (topics.includes("health") || topics.includes("education")) return "health-education";
  if (topics.includes("people")) return "people";
  if (topics.includes("development")) return "development";
  if (topics.includes("economy") || topics.includes("work") || topics.includes("technology") || topics.includes("infrastructure")) {
    return "economy";
  }
  if (topics.includes("environment")) return "environment";
  return null;
}

export function observationMap(profile: EntityProfile | null): Map<string, Observation> {
  const map = new Map<string, Observation>();
  if (!profile) return map;
  for (const obs of profile.observations) map.set(obs.indicatorId, obs);
  const headlines: Array<[string, Observation | null]> = [
    ["population", profile.headlines.population],
    ["gdp", profile.headlines.gdp],
    ["gdp-per-capita", profile.headlines.gdpPerCapita],
    ["hdi", profile.headlines.hdi],
    ["life-expectancy", profile.headlines.lifeExpectancy],
    ["land-area", profile.headlines.area],
  ];
  for (const [id, obs] of headlines) {
    if (obs && !map.has(id)) map.set(id, obs);
  }
  return map;
}

export function buildHeadlines(
  indicators: IndicatorDefinition[],
  byId: Map<string, Observation>,
): StatBlock[] {
  const catalog = new Map(indicators.map((i) => [i.id, i]));
  const out: StatBlock[] = [];
  for (const id of HEADLINE_IDS) {
    const ind = catalog.get(id);
    if (!ind) continue;
    const stat = displayStat(ind, byId.get(id) ?? null);
    if (stat.missing) continue;
    out.push(stat);
  }
  return out;
}

export function statsForSection(
  section: ProfileSectionId,
  entity: Entity,
  indicators: IndicatorDefinition[],
  byId: Map<string, Observation>,
): StatBlock[] {
  const out: StatBlock[] = [];
  for (const ind of indicators) {
    if (topicSection(ind.topics) !== section) continue;
    const obs = byId.get(ind.id) ?? null;
    if (!shouldShowIndicator(ind, obs)) continue;
    const stat = displayStat(ind, obs);
    const comparison = !stat.missing && obs?.value != null ? comparisonSentence(entity, ind, obs.period.year, obs.value) : undefined;
    out.push({ ...stat, comparison });
  }
  return out;
}

export function peopleCharts(entity: Entity, byId: Map<string, Observation>, accent?: string): ChartBlock[] {
  const charts: ChartBlock[] = [];
  const pop = byId.get("population");
  const popSeries = observationSeries(pop);
  if (pop && popSeries.length >= 8) {
    const svg = lineChartSvg(popSeries, {
      title: `Population of ${entity.commonName}, 1950 to 2100`,
      description: `UN World Population Prospects medium variant. Estimates through 2023; dashed line marks projections from 2024.`,
      unitLabel: "people",
      format: "compact-integer",
      accent,
    });
    if (svg) {
      charts.push({
        svg,
        caption: `Population of ${entity.commonName}. Solid line: estimates (1950–2023). Dashed line: medium-variant projections (2024–2100).`,
        source: `${sourceLabel(pop.sourceId)}, ${pop.dataset}`,
        rows: seriesTable(popSeries, "compact-integer", "Population"),
        valueLabel: "Population",
      });
    }
  }

  const a0 = byId.get("age-0-14-pct");
  const a1 = byId.get("age-15-64-pct");
  const a2 = byId.get("age-65-plus-pct");
  if (a0 && a1 && a2) {
    const s0 = observationSeries(a0);
    const s1 = observationSeries(a1);
    const s2 = observationSeries(a2);
    const svg = stackedAreaSvg(
      [
        { id: "age-0-14-pct", label: "Ages 0–14", points: s0 },
        { id: "age-15-64-pct", label: "Ages 15–64", points: s1 },
        { id: "age-65-plus-pct", label: "Ages 65+", points: s2 },
      ],
      {
        title: `Age structure of ${entity.commonName}`,
        description: `Share of population by broad age group, World Bank World Development Indicators.`,
      },
    );
    if (svg) {
      charts.push({
        svg,
        caption: `Age structure of ${entity.commonName} as a share of population.`,
        source: `${sourceLabel(a2.sourceId)}, ${a2.dataset}`,
        rows: seriesTable(s2, "percent", "Ages 65+").map((row) => ({
          ...row,
          value: `${row.value} aged 65+`,
        })),
        valueLabel: "Ages 65+",
      });
    }
  }
  return charts;
}

export function economyCharts(entity: Entity, byId: Map<string, Observation>, accent?: string): ChartBlock[] {
  const gdp = byId.get("gdp");
  const series = observationSeries(gdp);
  if (!gdp || series.length < 8) return [];
  const svg = lineChartSvg(series, {
    title: `GDP of ${entity.commonName} (current US$)`,
    description: `Gross domestic product in current US dollars, World Bank World Development Indicators.`,
    unitLabel: "current US$",
    format: "usd",
    accent,
  });
  if (!svg) return [];
  return [
    {
      svg,
      caption: `GDP of ${entity.commonName} in current US dollars.`,
      source: `${sourceLabel(gdp.sourceId)}, ${gdp.dataset}`,
      rows: seriesTable(series, "usd", "GDP"),
      valueLabel: "GDP",
    },
  ];
}

export function environmentCharts(entity: Entity, byId: Map<string, Observation>, accent?: string): ChartBlock[] {
  const charts: ChartBlock[] = [];
  const co2 = byId.get("co2-emissions");
  const series = observationSeries(co2);
  if (co2 && series.length >= 8) {
    const svg = lineChartSvg(series, {
      title: `CO₂ emissions, ${entity.commonName}`,
      description: `Annual CO₂ emissions from the Global Carbon Project via Our World in Data. Not IEA-EDGAR.`,
      unitLabel: "million tonnes",
      format: "compact-integer",
      accent,
    });
    if (svg) {
      charts.push({
        svg,
        caption: `CO₂ emissions of ${entity.commonName}. Global Carbon Project via Our World in Data.`,
        source: `${sourceLabel(co2.sourceId)}, ${co2.dataset}`,
        rows: seriesTable(series, "compact-integer", "CO₂"),
        valueLabel: "Million tonnes",
      });
    }
  }
  return charts;
}

export function healthCharts(entity: Entity, byId: Map<string, Observation>, accent?: string): ChartBlock[] {
  const lex = byId.get("life-expectancy");
  const series = observationSeries(lex);
  if (!lex || series.length < 8) return [];
  const svg = lineChartSvg(series, {
    title: `Life expectancy at birth, ${entity.commonName}`,
    description: `Life expectancy at birth. Estimates through 2023; dashed line marks UN WPP medium-variant projections from 2024.`,
    unitLabel: "years",
    format: "1-decimal",
    accent,
  });
  if (!svg) return [];
  return [
    {
      svg,
      caption: `Life expectancy at birth in ${entity.commonName}. Dashed line marks medium-variant projections.`,
      source: `${sourceLabel(lex.sourceId)}, ${lex.dataset}`,
      rows: seriesTable(series, "1-decimal", "Life expectancy"),
      valueLabel: "Years",
    },
  ];
}

export type SourceGroup = {
  sourceId: string;
  name: string;
  short: string;
  dataset: string;
  vintage: string;
  vintageLabel: string;
  licenseId: string;
  licenseLabel: string;
  url?: string;
  retrievedAt?: string;
  indicators: { id: string; label: string; year: number; status: string; originalIndicatorId: string }[];
};

export function sourceGroups(
  indicators: IndicatorDefinition[],
  profile: EntityProfile | null,
  manifest: DataManifest | null,
): SourceGroup[] {
  if (!profile) return [];
  const labels = new Map(indicators.map((i) => [i.id, i.label]));
  const groups = new Map<string, SourceGroup>();
  const manifestById = new Map((manifest?.sources ?? []).map((s) => [s.sourceId, s]));

  const ingest = (obs: Observation, alternate: boolean) => {
    const key = `${obs.sourceId}::${obs.dataset}::${obs.vintage}`;
    let group = groups.get(key);
    if (!group) {
      const pin = manifestById.get(obs.sourceId);
      group = {
        sourceId: obs.sourceId,
        name: sourceFullName(obs.sourceId),
        short: sourceLabel(obs.sourceId),
        dataset: obs.dataset,
        vintage: obs.vintage,
        vintageLabel: formatVintage(obs.vintage),
        licenseId: obs.licenseId,
        licenseLabel: licenseLabelSafe(obs.licenseId),
        url: pin?.url,
        retrievedAt: obs.retrievedAt,
        indicators: [],
      };
      groups.set(key, group);
    }
    if (!group.indicators.some((i) => i.id === obs.indicatorId)) {
      group.indicators.push({
        id: obs.indicatorId,
        label: (alternate ? "Alternate: " : "") + (labels.get(obs.indicatorId) ?? obs.indicatorId),
        year: obs.period.year,
        status: obs.status,
        originalIndicatorId: obs.originalIndicatorId,
      });
    }
  };

  for (const obs of profile.observations) ingest(obs, false);
  for (const obs of profile.alternates) ingest(obs, true);
  return [...groups.values()];
}

function licenseLabelSafe(id: string): string {
  if (id === "cc-by-3.0-igo") return "CC BY 3.0 IGO";
  if (id === "cc-by-4.0") return "CC BY 4.0";
  if (id === "cc-by-sa-3.0-igo") return "CC BY-SA 3.0 IGO";
  if (id === "imf-data-terms") return "IMF data terms";
  return id;
}

export function vintageSummary(manifest: DataManifest | null, headlines: StatBlock[]): string {
  const bits: string[] = [];
  if (manifest?.vintages.wpp) {
    bits.push(`UN WPP ${formatVintage(manifest.vintages.wpp)} (estimates through 2023; 2024–2100 medium-variant projections)`);
  }
  if (manifest?.vintages.wdi) {
    bits.push(`World Bank WDI, ${formatVintage(manifest.vintages.wdi)} release`);
  }
  const hdi = headlines.find((h) => h.id === "hdi");
  if (hdi?.missing) {
    bits.push("Human Development Index is not in this build");
  } else if (manifest?.vintages.hdr) {
    bits.push(`UNDP HDR ${formatVintage(manifest.vintages.hdr)}`);
  }
  const extra = manifest?.vintages;
  if (extra?.uis) bits.push(`UNESCO UIS ${formatVintage(extra.uis)}`);
  if (extra?.ilo) bits.push(`ILOSTAT ${formatVintage(extra.ilo)}`);
  if (extra?.weo) bits.push(`IMF WEO ${formatVintage(extra.weo)}`);
  if (extra?.owid) bits.push(`OWID CO₂ ${formatVintage(extra.owid)}`);
  return bits.join(". ") + ".";
}

export function navSections(present: Set<ProfileSectionId>): ProfileSection[] {
  const order: ProfileSectionId[] = [
    "overview",
    "people",
    "economy",
    "development",
    "health-education",
    "environment",
    "geography",
    "government",
    "sources",
  ];
  return order.filter((id) => present.has(id)).map((id) => ({ id, label: SECTION_LABELS[id] }));
}

export function isCountrySchema(entity: Entity): boolean {
  return entity.classification === "un-member" || entity.classification === "un-observer";
}
