import { useEffect, useRef, useState } from "preact/hooks";
import { CountryNav } from "./globe/CountryNav.tsx";
import { FallbackMap } from "./globe/FallbackMap.tsx";
import { HoverTooltip, TouchSheet } from "./globe/TouchSheet.tsx";
import { mountGlobe, navigateToProfile, type MountedGlobe } from "./globe/mount-map.ts";
import type { GlobeIndex, GlobeIndexEntry } from "./globe/types.ts";
import { isCoarsePointer, prefetchProfile, readFocusParam, resolveFocus } from "./globe/types.ts";
import { hasWebGL2 } from "./globe/webgl.ts";
import "./globe/globe.css";

type Props = {
  index: GlobeIndex | null;
};

type Mode = "pending" | "globe" | "fallback";

export default function GlobeIsland({ index }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedGlobe | null>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const [hover, setHover] = useState<{ entry: GlobeIndexEntry; x: number; y: number } | undefined>();
  const [sheet, setSheet] = useState<GlobeIndexEntry | undefined>();
  const [activeId, setActiveId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const entities = index?.entities ?? [];
  const focusEntry = entities.find((e) => e.id === activeId);

  useEffect(() => {
    const fromUrl = resolveFocus(entities, readFocusParam(window.location.search));
    if (fromUrl) setActiveId(fromUrl.id);
  }, [index]);

  useEffect(() => {
    if (!index || entities.length === 0) {
      setMode("fallback");
      return;
    }
    if (!hasWebGL2()) {
      setMode("fallback");
      return;
    }

    const el = stageRef.current;
    if (!el) return;
    let cancelled = false;

    mountGlobe(el, index, {
      onHover: (entry, point) => {
        if (isCoarsePointer()) return;
        setHover(entry ? { entry, x: point.x, y: point.y } : undefined);
        if (entry) setActiveId(entry.id);
      },
      onSelect: (entry, source) => {
        setActiveId(entry.id);
        prefetchProfile(entry.slug);
        if (source === "tap" || isCoarsePointer()) {
          setSheet(entry);
          setHover(undefined);
          return;
        }
        navigateToProfile(entry.slug);
      },
    })
      .then((api) => {
        if (cancelled) {
          api.destroy();
          return;
        }
        mounted.current = api;
        setMode("globe");
        const focus = resolveFocus(entities, readFocusParam(window.location.search));
        if (focus) {
          setActiveId(focus.id);
          api.flyTo(focus);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Globe failed to start");
        setMode("fallback");
      });

    return () => {
      cancelled = true;
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, [index]);

  const onChoose = (entry: GlobeIndexEntry) => {
    setActiveId(entry.id);
    setSheet(undefined);
    prefetchProfile(entry.slug);
    if (mode === "globe" && mounted.current) {
      mounted.current.flyTo(entry);
      return;
    }
    setHover({ entry, x: 24, y: 24 });
  };

  const missingData = !index || entities.length === 0;

  return (
    <div class="globe-home" data-focus={focusEntry?.id ?? ""}>
      <a class="skip-globe" href="#browse-countries">
        Skip globe, browse countries
      </a>

      {focusEntry ? (
        <p class="globe-focus-status" role="status">
          Showing <strong>{focusEntry.name}</strong> on Earth.
        </p>
      ) : null}

      <div class="globe-stage-wrap">
        {mode !== "fallback" ? (
          <div
            class="globe-stage"
            ref={stageRef}
            role="region"
            aria-label="Interactive globe. A searchable country list follows."
          />
        ) : (
          <FallbackMap
            index={index ?? { naturalEarthVersion: "", generatedAt: "", attribution: "", entities: [] }}
            onChoose={(entry) => {
              setActiveId(entry.id);
              if (isCoarsePointer()) setSheet(entry);
              else navigateToProfile(entry.slug);
            }}
            onHover={(entry) => {
              if (entry) setHover({ entry, x: 24, y: 24 });
              else setHover(undefined);
            }}
            activeId={activeId}
          />
        )}
        {mode === "pending" ? <p class="globe-status">Loading globe…</p> : null}

        {mode === "globe" && hover && !sheet ? <HoverTooltip entry={hover.entry} x={hover.x} y={hover.y} /> : null}
        {sheet ? <TouchSheet entry={sheet} onClose={() => setSheet(undefined)} /> : null}
      </div>

      {mode === "fallback" ? (
        <p class="muted globe-fallback-note">
          {missingData
            ? "Globe data is not built yet. Run pnpm geo:build."
            : error
              ? `WebGL2 globe unavailable (${error}). Using a static Robinson map.`
              : "WebGL2 is unavailable on this device. Using a static Robinson map. Search and the country list still work."}
        </p>
      ) : null}

      <CountryNav entities={entities} onChoose={onChoose} activeId={activeId} />
    </div>
  );
}
