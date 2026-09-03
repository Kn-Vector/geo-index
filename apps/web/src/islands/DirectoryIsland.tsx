import { useMemo, useState } from "preact/hooks";
import type { DirectoryRow } from "../lib/site-types.ts";
import { classificationLabel } from "../lib/labels.ts";

type SortKey = "name" | "population" | "hdi" | "lifeExpectancy";
type FilterKey = "all" | "un-member" | "un-observer" | "special-status" | "other";

type Props = {
  rows: DirectoryRow[];
};

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 2)} billion`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} million`;
  return new Intl.NumberFormat("en").format(n);
}

export default function DirectoryIsland({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [region, setRegion] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");

  const regions = useMemo(
    () => [...new Set(rows.map((r) => r.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "en")),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (filter === "other") {
        if (row.classification === "un-member" || row.classification === "un-observer" || row.classification === "special-status") {
          return false;
        }
      } else if (filter !== "all" && row.classification !== filter) {
        return false;
      }
      if (region !== "all" && row.region !== region) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.officialName.toLowerCase().includes(q) ||
        row.id.includes(q) ||
        row.iso2?.toLowerCase() === q ||
        row.iso3?.toLowerCase() === q
      );
    });
    const dir = sort === "name" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "en");
      const av = a[sort];
      const bv = b[sort];
      if (av == null && bv == null) return a.name.localeCompare(b.name, "en");
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir * (av === bv ? a.name.localeCompare(b.name, "en") : av < bv ? -1 : 1);
    });
  }, [rows, query, filter, region, sort]);

  return (
    <div class="directory">
      <form class="directory-controls" onSubmit={(e) => e.preventDefault()}>
        <p>
          <label for="directory-q">Search</label>
          <input
            id="directory-q"
            type="search"
            value={query}
            placeholder="Japan, PSE, special status…"
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          />
        </p>
        <p>
          <label for="directory-filter">Classification</label>
          <select id="directory-filter" value={filter} onChange={(e) => setFilter((e.currentTarget as HTMLSelectElement).value as FilterKey)}>
            <option value="all">All</option>
            <option value="un-member">UN members</option>
            <option value="un-observer">UN observers</option>
            <option value="special-status">Special status</option>
            <option value="other">Dependencies and other</option>
          </select>
        </p>
        <p>
          <label for="directory-region">Region</label>
          <select id="directory-region" value={region} onChange={(e) => setRegion((e.currentTarget as HTMLSelectElement).value)}>
            <option value="all">All regions</option>
            {regions.map((name) => (
              <option value={name}>{name}</option>
            ))}
          </select>
        </p>
        <p>
          <label for="directory-sort">Sort</label>
          <select id="directory-sort" value={sort} onChange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortKey)}>
            <option value="name">Name</option>
            <option value="population">Population</option>
            <option value="hdi">HDI</option>
            <option value="lifeExpectancy">Life expectancy</option>
          </select>
        </p>
      </form>

      <p class="muted" aria-live="polite">
        {visible.length} of {rows.length} profiles
      </p>

      <table class="directory-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            <th scope="col">Region</th>
            <th scope="col">Population</th>
            <th scope="col">HDI</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr>
              <th scope="row">
                <a href={`/countries/${row.id}/`}>{row.name}</a>
              </th>
              <td>{classificationLabel(row.classification)}</td>
              <td>
                {row.regionSlug ? <a href={`/regions/${row.regionSlug}/`}>{row.region}</a> : (row.region ?? "—")}
              </td>
              <td>{formatCompact(row.population)}</td>
              <td>{row.hdi == null ? "—" : row.hdi.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
