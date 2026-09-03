/** Relative luminance and WCAG 2 contrast. Paper/ink tokens match apps/web tokens. */

export const PAPER = { r: 0xf4, g: 0xef, b: 0xe6 };
export const INK = { r: 0x1b, g: 0x17, b: 0x12 };

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: Rgb): string {
  const n = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${n(rgb.r)}${n(rgb.g)}${n(rgb.b)}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isNearWhite(rgb: Rgb): boolean {
  return luminance(rgb) > 0.93;
}

export function isNearBlack(rgb: Rgb): boolean {
  return luminance(rgb) < 0.08;
}

export function isGenericRed(rgb: Rgb): boolean {
  return rgb.r > 160 && rgb.g < 80 && rgb.b < 80;
}

export function isGenericBlue(rgb: Rgb): boolean {
  return rgb.b > 140 && rgb.b > rgb.r && rgb.b > rgb.g && rgb.r < 120;
}

export function deepenForPaper(rgb: Rgb, minContrast = 4.5): Rgb {
  let current = { ...rgb };
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(current, PAPER) >= minContrast) return current;
    current = {
      r: current.r * 0.88,
      g: current.g * 0.88,
      b: current.b * 0.88,
    };
  }
  return current;
}
