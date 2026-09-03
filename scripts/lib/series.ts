import type { Observation, ObservationStatus } from "@geo-index/schema";
import type { IndicatorDefinition } from "@geo-index/schema";

export type SeriesPoint = {
  year: number;
  value: number;
  status: ObservationStatus;
};

export type SourceSeries = {
  originalIndicatorId: string;
  points: SeriesPoint[];
  notes?: string;
};

export type EntitySourceBag = Map<string, SourceSeries[]>;

export type GenericFetchMeta = {
  sourceId: string;
  dataset: string;
  vintage: string;
  url: string;
  filename?: string;
  sha256?: string;
  retrievedAt: string;
  bytes?: number;
  skipped?: boolean;
  licenseId: string;
  blocker?: string;
  estimateLastYear?: number;
};

export function latestEligible(points: SeriesPoint[], asOfYear: number): SeriesPoint | undefined {
  if (!points.length) return undefined;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const eligible = sorted.filter((p) => p.year <= asOfYear);
  return (eligible.length ? eligible : sorted).at(-1);
}

export function observationFromSeries(opts: {
  entityId: string;
  indicator: IndicatorDefinition;
  series: SourceSeries;
  asOfYear: number;
  meta: GenericFetchMeta;
  extraNotes?: string;
}): Observation | null {
  const latest = latestEligible(opts.series.points, opts.asOfYear);
  if (!latest) return null;
  const notes = [opts.series.notes, opts.extraNotes].filter(Boolean).join(" ");
  return {
    indicatorId: opts.indicator.id,
    entityId: opts.entityId,
    value: latest.value,
    unit: opts.indicator.unit,
    period: { year: latest.year },
    status: latest.status,
    sourceId: opts.meta.sourceId,
    dataset: opts.meta.dataset,
    originalIndicatorId: opts.series.originalIndicatorId,
    retrievedAt: opts.meta.retrievedAt,
    vintage: opts.meta.vintage,
    licenseId: opts.meta.licenseId,
    notes: notes || undefined,
    series: [...opts.series.points]
      .sort((a, b) => a.year - b.year)
      .map((p) => ({
        period: String(p.year),
        value: p.value,
        status: p.status,
      })),
  };
}

export function pushPoint(
  bag: EntitySourceBag,
  indicatorId: string,
  originalIndicatorId: string,
  point: SeriesPoint,
  notes?: string,
): void {
  const list = bag.get(indicatorId) ?? [];
  let series = list.find((s) => s.originalIndicatorId === originalIndicatorId);
  if (!series) {
    series = { originalIndicatorId, points: [], notes };
    list.push(series);
    bag.set(indicatorId, list);
  }
  series.points.push(point);
}
