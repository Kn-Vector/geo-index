import type { JSX } from "preact";
import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import type { GlobeIndex, GlobeIndexEntry } from "./types.ts";
import { classificationLabel } from "./types.ts";

type Props = {
  entities: GlobeIndex["entities"];
  onChoose: (entry: GlobeIndexEntry) => void;
  activeId?: string;
};

function matches(entry: GlobeIndexEntry, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    entry.name.toLowerCase().includes(query) ||
    entry.id.includes(query) ||
    (entry.iso2?.toLowerCase().includes(query) ?? false) ||
    (entry.iso3?.toLowerCase().includes(query) ?? false)
  );
}

export function CountryNav({ entities, onChoose, activeId }: Props) {
  const listId = useId();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => entities.filter((e) => matches(e, query)).slice(0, 12), [entities, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (entry: GlobeIndexEntry) => {
    setQuery(entry.name);
    setOpen(false);
    onChoose(entry);
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const entry = filtered[active];
      if (entry) {
        event.preventDefault();
        choose(entry);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const letters = useMemo(() => {
    const groups = new Map<string, GlobeIndexEntry[]>();
    for (const entry of entities) {
      const letter = entry.name.charAt(0).toUpperCase();
      const list = groups.get(letter) ?? [];
      list.push(entry);
      groups.set(letter, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entities]);

  return (
    <div class="country-nav">
      <div class="combobox">
        <label for={inputId}>Find a country</label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
          placeholder="Japan, Palestine, Tuvalu…"
          value={query}
          onInput={(e) => {
            setQuery((e.currentTarget as HTMLInputElement).value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {open && filtered.length > 0 ? (
          <ul id={listId} role="listbox" class="combobox-list">
            {filtered.map((entry, i) => (
              <li
                key={entry.id}
                id={`${listId}-${entry.id}`}
                role="option"
                aria-selected={i === active}
                class={i === active ? "is-active" : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(entry);
                }}
              >
                <span>{entry.name}</span>
                <span class="muted">{classificationLabel(entry.classification)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <nav id="browse-countries" class="country-directory" aria-label="Countries A to Z">
        <h2>Browse countries</h2>
        <p class="muted">
          The globe is not the only way in. This list is the accessible equivalent of clicking the map.
        </p>
        {letters.map(([letter, group]) => (
          <section key={letter} class="letter-group">
            <h3>{letter}</h3>
            <ul>
              {group.map((entry) => (
                <li key={entry.id}>
                  <a class={entry.id === activeId ? "is-current" : undefined} href={`/countries/${entry.slug}/`}>
                    {entry.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
