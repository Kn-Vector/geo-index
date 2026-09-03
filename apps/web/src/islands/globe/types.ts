export type GlobeIndexEntry = {
  id: string;
  slug: string;
  name: string;
  iso2?: string;
  iso3?: string;
  tier: string;
  classification: string;
  tiny: boolean;
  center: [number, number];
};

export type GlobeIndex = {
  naturalEarthVersion: string;
  generatedAt: string;
  attribution: string;
  entities: GlobeIndexEntry[];
};

export const QUERY_LAYERS = ["tiny-hit", "tiny-dot", "tiny-halo", "overlay-fill", "countries-fill"];

export const OVERLAY_IDS = new Set(["palestine", "kosovo", "taiwan", "western-sahara"]);

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isCoarsePointer(): boolean {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function classificationLabel(value: string): string {
  switch (value) {
    case "un-member":
      return "UN member";
    case "un-observer":
      return "UN observer";
    case "associated-state":
      return "Associated state";
    case "dependency":
      return "Dependency";
    case "sar":
      return "Special administrative region";
    case "territory":
      return "Territory";
    case "statistical-area":
      return "Statistical area";
    case "special-status":
      return "Special status";
    default:
      return value;
  }
}

export function flagSrc(iso2?: string): string | undefined {
  if (!iso2) return undefined;
  return `/flags/${iso2.toLowerCase()}.svg`;
}

export function profileHref(slug: string): string {
  return `/countries/${slug}/`;
}

export function prefetchProfile(slug: string): void {
  const href = profileHref(slug);
  if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  document.head.appendChild(link);
}

export function flyZoom(entry: Pick<GlobeIndexEntry, "tiny">): number {
  return entry.tiny ? 6.4 : 3.4;
}

/** Resolve /?focus= slug, id, or ISO code from the home URL. */
export function resolveFocus(
  entities: GlobeIndexEntry[],
  raw: string | null | undefined,
): GlobeIndexEntry | undefined {
  if (!raw) return undefined;
  const q = raw.trim().toLowerCase();
  if (!q) return undefined;
  return entities.find(
    (e) =>
      e.id === q ||
      e.slug === q ||
      e.iso3?.toLowerCase() === q ||
      e.iso2?.toLowerCase() === q,
  );
}

export function readFocusParam(search: string): string | undefined {
  const value = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("focus");
  return value?.trim() || undefined;
}
