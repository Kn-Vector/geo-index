import type { Observation, SeriesPoint } from "@geo-index/schema";
import { formatNumber } from "./format.ts";
import type { IndicatorFormat } from "@geo-index/schema";

export type ChartPoint = {
  year: number;
  value: number;
  status: string;
};

export type LineChartOptions = {
  title: string;
  description: string;
  unitLabel: string;
  format: IndicatorFormat;
  width?: number;
  height?: number;
  accent?: string;
};

export type StackedSeries = {
  id: string;
  label: string;
  points: ChartPoint[];
};

const INK = "#1b1712";
const MUTED = "#6d675c";
const RULE = "#c9c0b1";
const ACCENT = "#3f5c4a";
const PROJ = "#7d96aa";

function seriesPoints(obs: Observation | null | undefined): ChartPoint[] {
  if (!obs?.series?.length) return [];
  return obs.series
    .map((p: SeriesPoint) => ({ year: Number(p.period), value: p.value, status: p.status }))
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value));
}

export function observationSeries(obs: Observation | null | undefined): ChartPoint[] {
  return seriesPoints(obs);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / mag;
  const step = residual >= 7.5 ? 10 * mag : residual >= 3.5 ? 5 * mag : residual >= 1.5 ? 2 * mag : mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) ticks.push(v);
  return ticks;
}

function linePath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  return xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i]!.toFixed(2)}`).join(" ");
}

function areaPath(xs: number[], yTop: number[], yBot: number[]): string {
  if (xs.length === 0) return "";
  const up = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${yTop[i]!.toFixed(2)}`).join(" ");
  const down = xs
    .slice()
    .reverse()
    .map((x, i) => {
      const yi = yBot[xs.length - 1 - i]!;
      return `L${x.toFixed(2)},${yi.toFixed(2)}`;
    })
    .join(" ");
  return `${up} ${down} Z`;
}

export function lineChartSvg(points: ChartPoint[], opts: LineChartOptions): string | null {
  if (points.length < 3) return null;
  const width = opts.width ?? 640;
  const height = opts.height ?? 260;
  const pad = { top: 18, right: 16, bottom: 36, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const years = points.map((p) => p.year);
  const values = points.map((p) => p.value);
  const xMin = Math.min(...years);
  const xMax = Math.max(...years);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin > 0 && yMin / yMax > 0.4) yMin = yMin * 0.92;
  if (yMin > 0 && yMax - yMin < yMax * 0.08) yMin = Math.max(0, yMin - (yMax - yMin));

  const x = (year: number) => pad.left + ((year - xMin) / (xMax - xMin || 1)) * innerW;
  const y = (val: number) => pad.top + (1 - (val - yMin) / (yMax - yMin || 1)) * innerH;

  const firstProj = points.find((p) => p.status === "projection");
  const splitYear = firstProj?.year;
  const observed = splitYear != null ? points.filter((p) => p.year <= splitYear) : points;
  const projected = splitYear != null ? points.filter((p) => p.year >= splitYear) : [];

  const yTicks = niceTicks(yMin, yMax);
  const xTicks = niceTicks(xMin, xMax, 5).filter((t) => t >= xMin && t <= xMax);

  const grid = yTicks
    .map((t) => {
      const yy = y(t);
      return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${RULE}" stroke-width="1"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((t) => {
      const label = formatNumber(t, opts.format);
      return `<text x="${pad.left - 8}" y="${y(t).toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" font-size="11">${escapeXml(label)}</text>`;
    })
    .join("");

  const xLabels = xTicks
    .map((t) => {
      return `<text x="${x(t).toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="${MUTED}" font-size="11">${t}</text>`;
    })
    .join("");

  const obsPath = linePath(
    observed.map((p) => x(p.year)),
    observed.map((p) => y(p.value)),
  );
  const projPath = linePath(
    projected.map((p) => x(p.year)),
    projected.map((p) => y(p.value)),
  );

  const splitMark =
    splitYear != null
      ? `<line x1="${x(splitYear).toFixed(1)}" x2="${x(splitYear).toFixed(1)}" y1="${pad.top}" y2="${pad.top + innerH}" stroke="${PROJ}" stroke-dasharray="3 4" stroke-width="1"/>
         <text x="${Math.min(x(splitYear) + 6, width - pad.right - 4).toFixed(1)}" y="${pad.top + 12}" fill="${PROJ}" font-size="11">Projection</text>`
      : "";

  const titleId = `chart-title-${slug(opts.title)}`;
  const descId = `chart-desc-${slug(opts.title)}`;

  return `<svg class="profile-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${titleId} ${descId}" preserveAspectRatio="xMidYMid meet">
  <title id="${titleId}">${escapeXml(opts.title)}</title>
  <desc id="${descId}">${escapeXml(opts.description)}</desc>
  ${grid}
  ${yLabels}
  ${xLabels}
  ${splitMark}
  ${obsPath ? `<path d="${obsPath}" fill="none" stroke="${opts.accent ?? ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
  ${projPath ? `<path d="${projPath}" fill="none" stroke="${PROJ}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
  <line x1="${pad.left}" x2="${width - pad.right}" y1="${(pad.top + innerH).toFixed(1)}" y2="${(pad.top + innerH).toFixed(1)}" stroke="${INK}" stroke-width="1"/>
</svg>`;
}

export function stackedAreaSvg(
  series: StackedSeries[],
  opts: { title: string; description: string; width?: number; height?: number },
): string | null {
  if (series.length < 2) return null;
  const years = series[0]!.points.map((p) => p.year);
  if (years.length < 3) return null;
  const aligned = series.map((s) => {
    const map = new Map(s.points.map((p) => [p.year, p.value]));
    return years.map((y) => map.get(y) ?? 0);
  });

  const width = opts.width ?? 640;
  const height = opts.height ?? 240;
  const pad = { top: 18, right: 16, bottom: 36, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xMin = years[0]!;
  const xMax = years[years.length - 1]!;
  const x = (year: number) => pad.left + ((year - xMin) / (xMax - xMin || 1)) * innerW;
  const y = (val: number) => pad.top + (1 - val / 100) * innerH;
  const xs = years.map((yr) => x(yr));

  const colors = ["#c9b48c", "#3f5c4a", "#5e7a90"];
  const stacks: number[][] = aligned.map(() => []);
  for (let i = 0; i < years.length; i++) {
    let acc = 0;
    for (let s = 0; s < aligned.length; s++) {
      acc += aligned[s]![i]!;
      stacks[s]![i] = acc;
    }
  }

  const layers = series
    .map((s, si) => {
      const top = stacks[si]!.map((v) => y(v));
      const bot = si === 0 ? years.map(() => y(0)) : stacks[si - 1]!.map((v) => y(v));
      const d = areaPath(xs, top, bot);
      return `<path d="${d}" fill="${colors[si % colors.length]}" fill-opacity="0.82" stroke="${INK}" stroke-opacity="0.2" stroke-width="0.5"/>`;
    })
    .join("");

  const legend = series
    .map((s, i) => {
      const lx = pad.left + i * 140;
      return `<rect x="${lx}" y="${height - 22}" width="10" height="10" fill="${colors[i % colors.length]}"/><text x="${lx + 16}" y="${height - 13}" font-size="11" fill="${MUTED}">${escapeXml(s.label)}</text>`;
    })
    .join("");

  const xTicks = [years[0]!, years[Math.floor(years.length / 2)]!, years[years.length - 1]!];
  const xLabels = xTicks
    .map((t) => `<text x="${x(t).toFixed(1)}" y="${height - 28}" text-anchor="middle" fill="${MUTED}" font-size="11">${t}</text>`)
    .join("");

  const titleId = `chart-title-${slug(opts.title)}`;
  const descId = `chart-desc-${slug(opts.title)}`;

  return `<svg class="profile-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${titleId} ${descId}" preserveAspectRatio="xMidYMid meet">
  <title id="${titleId}">${escapeXml(opts.title)}</title>
  <desc id="${descId}">${escapeXml(opts.description)}</desc>
  ${layers}
  <line x1="${pad.left}" x2="${width - pad.right}" y1="${(pad.top + innerH).toFixed(1)}" y2="${(pad.top + innerH).toFixed(1)}" stroke="${INK}" stroke-width="1"/>
  ${xLabels}
  ${legend}
</svg>`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
}

export function seriesTable(points: ChartPoint[], format: IndicatorFormat, label: string): { year: string; value: string; status: string }[] {
  const step = points.length > 20 ? Math.ceil(points.length / 16) : 1;
  return points
    .filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0)
    .map((p) => ({
      year: String(p.year),
      value: formatNumber(p.value, format),
      status: p.status,
    }))
    .concat(
      label
        ? []
        : [],
    );
}
