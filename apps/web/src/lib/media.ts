export type ThemeToken = {
  entityId: string;
  accent: string;
  accentMuted: string;
  source: "flag" | "override" | "default";
  contrastOnPaper: number;
  contrastOnInk: number;
};

export type MediaAsset = {
  entityId: string;
  role: "hero" | "landscape" | "urban" | "architecture" | "culture" | "nature" | "flag" | "emblem" | "silhouette";
  src: string;
  alt: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  creator?: string;
  pageUrl?: string;
  attributionRequired: boolean;
};

export type GeographyNote = {
  entityId: string;
  capitals?: { name: string; role: string }[];
  note?: string;
  source: string;
};

export const DEFAULT_THEME: ThemeToken = {
  entityId: "",
  accent: "#3f5c4a",
  accentMuted: "#5e7a90",
  source: "default",
  contrastOnPaper: 5.4,
  contrastOnInk: 4.6,
};

export function pickHero(assets: MediaAsset[]): MediaAsset | undefined {
  return assets.find((a) => a.role === "hero") ?? assets.find((a) => a.role !== "flag" && a.role !== "silhouette");
}
