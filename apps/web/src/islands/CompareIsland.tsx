import { useEffect, useMemo, useState } from "preact/hooks";
import type { CompareEntity } from "../lib/site-types.ts";
import { classificationLabel } from "../lib/labels.ts";
import { formatNumber } from "../lib/profile/format.ts";
import type { IndicatorDefinition } from "@geo-index/schema";

type Props = {
  entities: CompareEntity[];
  indicators: IndicatorDefinition[];
  initialIds?: string[];
};

function parseIds(search: string): string[] {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ids") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);
}

function resolve(entities: CompareEntity[], token: string): CompareEntity | undefined {
  return entities.find(
    (e) => e.id === token || e.iso3?.toLowerCase() === token || e.iso2?.toLowerCase() === token,
  );
}

export default function CompareIsland({ entities, indicators, initialIds = [] }: Props) {
  const [tokens, setTokens] = useState<string[]>(initialIds);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const fromUrl = parseIds(window.location.search);
    if (fromUrl.length) setTokens(fromUrl);
  }, []);

  const selected = useMemo(
    () => tokens.map((t) => resolve(entities, t)).filter((e): e is CompareEntity => e != null),
    [entities, tokens],
  );

  const pushUrl = (next: string[]) => {
    const unique = [...new Set(next)].slice(0, 4);
    setTokens(unique);
    const url = unique.length ? `/compare/?ids=${unique.join(",")}` : "/compare/";
    window.history.replaceState(null, "", url);
  };

  const add = () => {
    const hit = resolve(entities, draft.trim().toLowerCase()) ?? entities.find((e) => e.name.toLowerCase() === draft.trim().toLowerCase());
    if (!hit) return;
    pushUrl([...selected.map((s) => s.id), hit.id]);
    setDraft("");
  };

  const remove = (id: string) => pushUrl(selected.filter((s) => s.id !== id).map((s) => s.id));

  const rows = indicators.filter((ind) => selected.some((e) => e.observations[ind.id]));

  return (
    <div class="compare">
      <form
        class="compare-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label for="compare-add">Add a profile (2–4)</label>
        <div class="compare-add-row">
          <input
            id="compare-add"
            list="compare-names"
            value={draft}
            placeholder="Japan, DEU, nigeria…"
            onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
          />
          <button type="submit" disabled={selected.length >= 4}>
            Add
          </button>
        </div>
        <datalist id="compare-names">
          {entities.map((e) => (
            <option value={e.name} />
          ))}
        </datalist>
      </form>

      {selected.length < 2 ? (
        <p class="muted">Choose two to four profiles. Missing values stay missing; they are not treated as zero.</p>
      ) : null}

      {selected.length ? (
        <ul class="compare-pills">
          {selected.map((e) => (
            <li>
              <a href={`/countries/${e.id}/`}>{e.name}</a>
              <span class="muted"> {classificationLabel(e.classification)}</span>
              <button type="button" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected.length >= 2 ? (
        <table class="compare-table">
          <thead>
            <tr>
              <th scope="col">Indicator</th>
              {selected.map((e) => (
                <th scope="col">{e.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((ind) => (
              <tr>
                <th scope="row">
                  <a href={`/indicators/${ind.id}/`}>{ind.label}</a>
                </th>
                {selected.map((e) => {
                  const obs = e.observations[ind.id];
                  if (!obs || obs.value == null) return <td>—</td>;
                  return (
                    <td>
                      {formatNumber(obs.value, ind.format)}
                      <div class="muted">
                        {obs.year} · {obs.status}
                        {obs.status === "projection" ? " (forecast)" : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
