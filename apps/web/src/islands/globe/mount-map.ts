import type { GlobeIndex, GlobeIndexEntry } from "./types.ts";
import {
  QUERY_LAYERS,
  OVERLAY_IDS,
  flyZoom,
  prefersReducedMotion,
  prefetchProfile,
  profileHref,
} from "./types.ts";

export type GlobeHandlers = {
  onHover: (entry: GlobeIndexEntry | undefined, point: { x: number; y: number }) => void;
  onSelect: (entry: GlobeIndexEntry, source: "click" | "tap") => void;
};

type MapLibreNS = typeof import("maplibre-gl");
type MapInstance = InstanceType<MapLibreNS["Map"]>;
type MapMouseEvent = import("maplibre-gl").MapMouseEvent;

function hatchImageData(): ImageData {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const on = (x + y) % 4 === 0;
      data[i] = 138;
      data[i + 1] = 75;
      data[i + 2] = 47;
      data[i + 3] = on ? 210 : 0;
    }
  }
  return new ImageData(data, size, size);
}

function pickFeature(
  map: MapInstance,
  point: { x: number; y: number },
): { id: string; slug: string } | undefined {
  const hits = map.queryRenderedFeatures(point, { layers: QUERY_LAYERS });
  if (!hits.length) return undefined;
  const overlay = hits.find((h) => typeof h.properties?.id === "string" && OVERLAY_IDS.has(h.properties.id));
  const chosen = overlay ?? hits[0];
  const id = chosen.properties?.id;
  const slug = chosen.properties?.slug ?? id;
  if (typeof id !== "string" || typeof slug !== "string") return undefined;
  return { id, slug };
}

export type MountedGlobe = {
  map: MapInstance;
  flyTo: (entry: GlobeIndexEntry) => void;
  highlight: (id: string | undefined) => void;
  destroy: () => void;
};

export async function mountGlobe(
  container: HTMLElement,
  index: GlobeIndex,
  handlers: GlobeHandlers,
): Promise<MountedGlobe> {
  const maplibregl = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  const reduced = prefersReducedMotion();
  const byId = new Map(index.entities.map((e) => [e.id, e]));
  let hoveredId: string | undefined;

  const styleResponse = await fetch("/geo/globe-style.json");
  if (!styleResponse.ok) {
    throw new Error("Globe style missing. Run pnpm geo:build.");
  }
  const style = await styleResponse.json();

  const map = new maplibregl.Map({
    container,
    style,
    center: [12, 18],
    zoom: 1.35,
    minZoom: 0.6,
    maxZoom: 8,
    attributionControl: {
      compact: true,
      customAttribution: "Made with Natural Earth",
    },
    fadeDuration: reduced ? 0 : 250,
    dragPan: {
      maxSpeed: reduced ? 0 : 1400,
      deceleration: reduced ? 20_000 : 2500,
    },
    keyboard: true,
    pitchWithRotate: !reduced,
    cancelPendingTileRequestsWhileZooming: true,
  });

  map.keyboard.enable();
  if (reduced) {
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
  }

  const setHover = (id: string | undefined, point?: { x: number; y: number }) => {
    if (hoveredId === id) {
      if (id && point) {
        const entry = byId.get(id);
        if (entry) handlers.onHover(entry, point);
      }
      return;
    }
    if (hoveredId) map.setFeatureState({ source: "countries", id: hoveredId }, { hover: false });
    if (hoveredId) map.setFeatureState({ source: "tiny", id: hoveredId }, { hover: false });
    hoveredId = id;
    if (id) {
      map.setFeatureState({ source: "countries", id }, { hover: true });
      map.setFeatureState({ source: "tiny", id }, { hover: true });
    }
    map.getCanvas().style.cursor = id ? "pointer" : "";
    const entry = id ? byId.get(id) : undefined;
    if (entry && point) {
      prefetchProfile(entry.slug);
      handlers.onHover(entry, point);
    } else {
      handlers.onHover(undefined, point ?? { x: 0, y: 0 });
    }
  };

  map.on("styleimagemissing", (event: { id: string }) => {
    if (event.id === "dispute-hatch" && !map.hasImage("dispute-hatch")) {
      map.addImage("dispute-hatch", hatchImageData(), { pixelRatio: 2 });
    }
  });

  const onMove = (event: MapMouseEvent) => {
    const hit = pickFeature(map, event.point);
    setHover(hit?.id, event.point);
  };

  const onLeave = () => setHover(undefined);

  const onClick = (event: MapMouseEvent) => {
    const hit = pickFeature(map, event.point);
    if (!hit) return;
    const entry = byId.get(hit.id);
    if (!entry) return;
    prefetchProfile(entry.slug);
    const tap = event.originalEvent instanceof PointerEvent
      ? event.originalEvent.pointerType === "touch"
      : "touches" in event.originalEvent;
    handlers.onSelect(entry, tap ? "tap" : "click");
  };

  map.on("load", () => {
    map.getCanvas().setAttribute("aria-label", "Interactive globe");
  });
  map.on("mousemove", onMove);
  map.on("mouseleave", onLeave);
  map.on("click", onClick);

  const flyTo = (entry: GlobeIndexEntry) => {
    const go = () => {
      setHover(entry.id);
      const camera = { center: entry.center as [number, number], zoom: flyZoom(entry), essential: true };
      if (prefersReducedMotion()) map.jumpTo(camera);
      else map.flyTo({ ...camera, duration: 1600 });
    };
    const whenStyleReady = () => {
      if (map.isStyleLoaded()) go();
      else map.once("idle", go);
    };
    if (map.loaded()) whenStyleReady();
    else map.once("load", whenStyleReady);
  };

  const highlight = (id: string | undefined) => setHover(id);

  const destroy = () => {
    map.off("mousemove", onMove);
    map.off("mouseleave", onLeave);
    map.off("click", onClick);
    map.remove();
  };

  return { map, flyTo, highlight, destroy };
}

export function navigateToProfile(slug: string): void {
  window.location.assign(profileHref(slug));
}
