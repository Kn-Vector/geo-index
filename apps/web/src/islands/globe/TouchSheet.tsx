import type { GlobeIndexEntry } from "./types.ts";
import { classificationLabel, flagSrc, profileHref } from "./types.ts";

type Props = {
  entry: GlobeIndexEntry;
  onClose: () => void;
};

export function TouchSheet({ entry, onClose }: Props) {
  const src = flagSrc(entry.iso2);
  return (
    <div class="touch-sheet" role="dialog" aria-modal="false" aria-labelledby="touch-sheet-title">
      <button type="button" class="touch-sheet-dismiss" onClick={onClose} aria-label="Dismiss">
        Close
      </button>
      <div class="touch-sheet-body">
        {src ? <img src={src} alt="" width="40" height="30" class="flag" /> : null}
        <div>
          <h2 id="touch-sheet-title">{entry.name}</h2>
          <p class="muted">{classificationLabel(entry.classification)}</p>
        </div>
      </div>
      <a class="touch-sheet-open" href={profileHref(entry.slug)}>
        Open profile
      </a>
    </div>
  );
}

type TooltipProps = {
  entry: GlobeIndexEntry;
  x: number;
  y: number;
};

export function HoverTooltip({ entry, x, y }: TooltipProps) {
  const src = flagSrc(entry.iso2);
  return (
    <div class="globe-tooltip" style={{ transform: `translate(${x + 14}px, ${y + 14}px)` }} role="status">
      {src ? <img src={src} alt="" width="22" height="16" class="flag" /> : null}
      <span>{entry.name}</span>
    </div>
  );
}
