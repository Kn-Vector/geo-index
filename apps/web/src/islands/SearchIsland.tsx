import { useEffect, useRef, useState } from "preact/hooks";

type PagefindUICtor = new (opts: {
  element: HTMLElement;
  showImages?: boolean;
  excerptLength?: number;
  showSubResults?: boolean;
}) => unknown;

export default function SearchIsland() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.onload = () => {
      if (cancelled || !hostRef.current) return;
      const Ctor = (window as unknown as { PagefindUI?: PagefindUICtor }).PagefindUI;
      if (!Ctor) {
        setAvailable(false);
        return;
      }
      new Ctor({
        element: hostRef.current,
        showImages: false,
        excerptLength: 18,
        showSubResults: true,
      });
      setAvailable(true);
    };
    script.onerror = () => {
      if (!cancelled) setAvailable(false);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
      css.remove();
    };
  }, []);

  return (
    <div class="site-search">
      <div ref={hostRef} hidden={available === false} />
      {available === false ? (
        <p class="site-search-fallback">
          <a href="/countries/">Search the directory</a>
          <span class="muted"> Site-wide search is built with Pagefind after a production build.</span>
        </p>
      ) : null}
    </div>
  );
}
