import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Resvg } from "@resvg/resvg-js";
import { CATALOG_DIR, ROOT } from "../lib/paths.ts";
import { countrySilhouette } from "../../apps/web/src/lib/profile/silhouette.ts";

export type OgEntity = {
  id: string;
  commonName: string;
  isoAlpha2?: string;
};

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#f4efe6";
const INK = "#1b1712";
const MUTED = "#6d675c";
const ACCENT = "#3f5c4a";

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function systemFontFiles(): string[] {
  const candidates = [
    "C:\\Windows\\Fonts\\georgia.ttf",
    "C:\\Windows\\Fonts\\georgiab.ttf",
    "C:\\Windows\\Fonts\\times.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
  ];
  return candidates.filter((file) => fs.existsSync(file));
}

function silhouettePath(entityId: string, name: string): string | undefined {
  const sil = countrySilhouette(entityId, name);
  if (!sil) return undefined;
  const match = /<path d="([^"]+)"/.exec(sil.svg);
  return match?.[1];
}

function flagDataUri(flagDir: string, isoAlpha2?: string): string | undefined {
  if (!isoAlpha2) return undefined;
  const file = path.join(flagDir, `${isoAlpha2.toLowerCase()}.svg`);
  if (!fs.existsSync(file)) return undefined;
  const svg = fs.readFileSync(file);
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

export function buildOgSvg(
  entity: OgEntity | null,
  options: { flagDir?: string } = {},
): string {
  const flag = entity && options.flagDir ? flagDataUri(options.flagDir, entity.isoAlpha2) : undefined;
  const pathD = entity ? silhouettePath(entity.id, entity.commonName) : undefined;
  const title = entity ? entity.commonName : "Geo Index";
  const subtitle = entity ? "Population, economy, health, geography" : "An editorial world atlas";

  const flagMarkup = flag
    ? `<image href="${flag}" x="72" y="88" width="128" height="96" preserveAspectRatio="xMidYMid slice"/>
  <rect x="72" y="88" width="128" height="96" fill="none" stroke="#c9c0b1" stroke-width="2"/>`
    : "";

  const silMarkup = pathD
    ? `<g transform="translate(820,90) scale(1.55)" fill="${ACCENT}" fill-opacity="0.88">
    <path d="${pathD}"/>
  </g>`
    : "";

  const nameY = flag ? 280 : 240;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
  <rect x="0" y="0" width="16" height="${HEIGHT}" fill="${ACCENT}"/>
  ${flagMarkup}
  ${silMarkup}
  <text x="72" y="${nameY}" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="${INK}">${escapeXml(title)}</text>
  <text x="72" y="${nameY + 70}" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="${MUTED}">${escapeXml(subtitle)}</text>
  <text x="72" y="560" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="${MUTED}">Geo Index</text>
</svg>`;
}

export function renderOgPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: {
      fontFiles: systemFontFiles(),
      loadSystemFonts: true,
      defaultFontFamily: "Georgia",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

export function writeOgImages(entities: OgEntity[], destDir: string, flagDir: string): { written: number } {
  fs.mkdirSync(destDir, { recursive: true });
  const defaultPng = renderOgPng(buildOgSvg(null));
  fs.writeFileSync(path.join(destDir, "default.png"), defaultPng);

  let written = 1;
  for (const entity of entities) {
    const png = renderOgPng(buildOgSvg(entity, { flagDir }));
    fs.writeFileSync(path.join(destDir, `${entity.id}.png`), png);
    written += 1;
  }
  return { written };
}

function loadCatalogEntities(): OgEntity[] {
  const raw = YAML.parse(fs.readFileSync(path.join(CATALOG_DIR, "entities.yaml"), "utf8")) as {
    entities: OgEntity[];
  };
  return raw.entities;
}

const invoked = process.argv[1] ?? "";
if (!process.env.VITEST && /(^|[/\\])og\.(ts|js)$/.test(invoked)) {
  const entities = loadCatalogEntities();
  const result = writeOgImages(entities, path.join(ROOT, "apps/web/public/og"), path.join(ROOT, "apps/web/public/flags"));
  console.log(`og:build written=${result.written}`);
}
