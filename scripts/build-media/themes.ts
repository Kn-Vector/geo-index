import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ROOT } from "../lib/paths.ts";
import {
  INK,
  PAPER,
  contrastRatio,
  deepenForPaper,
  hexToRgb,
  isGenericBlue,
  isGenericRed,
  isNearBlack,
  isNearWhite,
  rgbToHex,
  type Rgb,
} from "../lib/contrast.ts";

export type ThemeToken = {
  entityId: string;
  accent: string;
  accentMuted: string;
  source: "flag" | "override" | "default";
  contrastOnPaper: number;
  contrastOnInk: number;
};

type OverrideFile = {
  overrides?: Record<string, { accent: string; reason?: string }>;
};

const DEFAULT_ACCENT = "#3f5c4a";
const MIN_CONTRAST = 4.5;

function parseSvgColors(svg: string): Rgb[] {
  const found: Rgb[] = [];
  const add = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (rgb) found.push(rgb);
  };
  for (const match of svg.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) add(match[0]!);
  for (const match of svg.matchAll(/fill=["'](#[0-9a-fA-F]{3,8})["']/g)) add(match[1]!);
  for (const match of svg.matchAll(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)) {
    found.push({ r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) });
  }
  return found;
}

function uniqueColors(colors: Rgb[]): Rgb[] {
  const seen = new Set<string>();
  const out: Rgb[] = [];
  for (const c of colors) {
    const key = rgbToHex(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function pickAccent(colors: Rgb[]): Rgb | undefined {
  const usable = colors.filter((c) => !isNearWhite(c) && !isNearBlack(c));
  if (usable.length === 0) return undefined;
  const onlyRwb =
    usable.length >= 2 &&
    usable.every((c) => isGenericRed(c) || isGenericBlue(c) || isNearWhite(c));
  const scored = usable
    .filter((c) => !(onlyRwb && (isGenericRed(c) || isGenericBlue(c))))
    .concat(onlyRwb ? usable : []);
  const ranked = (scored.length ? scored : usable)
    .map((c) => ({ c, contrast: contrastRatio(c, PAPER) }))
    .sort((a, b) => b.contrast - a.contrast);
  return ranked[0]?.c;
}

function loadOverrides(): OverrideFile["overrides"] {
  const file = path.join(ROOT, "data/themes/overrides.yaml");
  if (!fs.existsSync(file)) return {};
  const raw = YAML.parse(fs.readFileSync(file, "utf8")) as OverrideFile;
  return raw.overrides ?? {};
}

export function themeFromFlag(entityId: string, iso2: string | undefined, flagDir: string): ThemeToken {
  const overrides = loadOverrides();
  const forced = overrides?.[entityId];
  if (forced) {
    const rgb = hexToRgb(forced.accent);
    if (!rgb) throw new Error(`Invalid override accent for ${entityId}: ${forced.accent}`);
    const paper = contrastRatio(rgb, PAPER);
    const ink = contrastRatio(rgb, INK);
    if (paper < MIN_CONTRAST && ink < MIN_CONTRAST) {
      throw new Error(
        `Theme override for ${entityId} fails WCAG 4.5:1 against paper (${paper.toFixed(2)}) and ink (${ink.toFixed(2)})`,
      );
    }
    return {
      entityId,
      accent: rgbToHex(rgb),
      accentMuted: rgbToHex(deepenForPaper({ r: rgb.r + 30, g: rgb.g + 20, b: rgb.b + 10 }, 3)),
      source: "override",
      contrastOnPaper: paper,
      contrastOnInk: ink,
    };
  }

  const flagFile = iso2 ? path.join(flagDir, `${iso2.toLowerCase()}.svg`) : undefined;
  if (flagFile && fs.existsSync(flagFile)) {
    const colors = uniqueColors(parseSvgColors(fs.readFileSync(flagFile, "utf8")));
    const picked = pickAccent(colors);
    if (picked) {
      const deepened = deepenForPaper(picked, MIN_CONTRAST);
      const paper = contrastRatio(deepened, PAPER);
      const ink = contrastRatio(deepened, INK);
      if (paper < MIN_CONTRAST && ink < MIN_CONTRAST) {
        throw new Error(`Theme for ${entityId} cannot meet 4.5:1 after deepening flag colours.`);
      }
      return {
        entityId,
        accent: rgbToHex(deepened),
        accentMuted: rgbToHex(deepenForPaper(picked, 3)),
        source: "flag",
        contrastOnPaper: paper,
        contrastOnInk: ink,
      };
    }
  }

  const fallback = hexToRgb(DEFAULT_ACCENT)!;
  return {
    entityId,
    accent: DEFAULT_ACCENT,
    accentMuted: "#5e7a90",
    source: "default",
    contrastOnPaper: contrastRatio(fallback, PAPER),
    contrastOnInk: contrastRatio(fallback, INK),
  };
}

export function buildThemes(
  entities: { id: string; isoAlpha2?: string }[],
  flagDir: string,
): ThemeToken[] {
  return entities.map((e) => themeFromFlag(e.id, e.isoAlpha2, flagDir));
}
