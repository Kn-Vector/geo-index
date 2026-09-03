import { useEffect, useRef } from "preact/hooks";
import type { GlobeIndex, GlobeIndexEntry } from "./types.ts";
import { prefersReducedMotion, prefetchProfile, readFocusParam } from "./types.ts";

type Props = {
  index: GlobeIndex;
  onChoose: (entry: GlobeIndexEntry) => void;
  onHover: (entry: GlobeIndexEntry | undefined) => void;
  activeId?: string;
};

export function FallbackMap({ index, onChoose, onHover, activeId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const bySlug = new Map(index.entities.map((e) => [e.slug, e]));

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;

    fetch("/geo/world-robinson.svg")
      .then((r) => {
        if (!r.ok) throw new Error("SVG missing");
        return r.text();
      })
      .then((svg) => {
        if (cancelled || !host) return;
        host.innerHTML = svg;
        const root = host.querySelector("svg");
        if (!root) return;
        const defaultView = root.getAttribute("viewBox");

        const focus = (el: SVGGraphicsElement, instant: boolean) => {
          const box = el.getBBox();
          const pad = Math.max(box.width, box.height, 40) * 0.8;
          const vb = `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`;
          if (instant || prefersReducedMotion()) root.setAttribute("viewBox", vb);
          else {
            root.style.transition = "none";
            root.setAttribute("viewBox", vb);
          }
        };

        const activate = (el: Element, navigate: boolean) => {
          const slug = el.getAttribute("data-slug");
          if (!slug) return;
          const entry = bySlug.get(slug);
          if (!entry) return;
          host.querySelectorAll(".is-active").forEach((n) => n.classList.remove("is-active"));
          el.classList.add("is-active");
          prefetchProfile(entry.slug);
          if (el instanceof SVGGraphicsElement) focus(el, prefersReducedMotion());
          onHover(entry);
          if (navigate) onChoose(entry);
        };

        host.querySelectorAll("[data-slug]").forEach((el) => {
          el.addEventListener("mouseenter", () => activate(el, false));
          el.addEventListener("mouseleave", () => onHover(undefined));
          el.addEventListener("click", () => activate(el, true));
        });

        const urlFocus = readFocusParam(window.location.search);
        const focusId = activeId ?? urlFocus;
        if (focusId) {
          const current = host.querySelector(`[data-id="${focusId}"]`);
          if (current instanceof SVGGraphicsElement) {
            current.classList.add("is-active");
            focus(current, true);
          }
        } else if (defaultView) {
          root.setAttribute("viewBox", defaultView);
        }
      })
      .catch(() => {
        if (host) {
          host.innerHTML =
            "<p class='muted'>Static world map is not built yet. Run <code>pnpm geo:build</code>.</p>";
        }
      });

    return () => {
      cancelled = true;
      if (host) host.innerHTML = "";
    };
  }, [index, activeId]);

  return (
    <div class="svg-fallback" ref={ref} role="region" aria-label="Static world map, Robinson projection" />
  );
}

