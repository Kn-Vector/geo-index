/**
 * One-time helper that built committed identifier snapshots from local
 * research captures. Runtime rebuilds use data/raw/identifiers/* plus
 * `pnpm data:fetch` (Wikidata). Do not depend on agent-tools paths.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ID = path.join(ROOT, "data/raw/identifiers");
fs.mkdirSync(ID, { recursive: true });

const agentTools = "C:/Users/Fred/.cursor/projects/c-Users-Fred-Geo-Index/agent-tools";

fs.copyFileSync(
  path.join(agentTools, "76a83af1-8937-4af4-9787-363849d84c5d.txt"),
  path.join(ID, "iso-3166-1.json"),
);

const membersPage = fs.readFileSync(
  path.join(agentTools, "03a7d549-2be1-4791-b831-b266f542cf9b.txt"),
  "utf8",
);
const memberNames = [];
let on = false;
for (const line of membersPage.split(/\r?\n/)) {
  if (line === "- Afghanistan") on = true;
  if (on) {
    if (line === "- Non-Member Observer State Resources") break;
    if (line.startsWith("- ")) memberNames.push(line.slice(2));
  }
}
if (memberNames.length !== 193) {
  throw new Error(`expected 193 members, got ${memberNames.length}`);
}
fs.writeFileSync(
  path.join(ID, "un-members.json"),
  `${JSON.stringify(
    {
      source: "https://research.un.org/en/unmembers/currentmembers",
      retrievedNote:
        "Names taken from the UN Dag Hammarskjöld Library current members listing (193).",
      count: memberNames.length,
      names: memberNames,
    },
    null,
    2,
  )}\n`,
);

const m49md = fs.readFileSync(
  path.join(agentTools, "853a763b-2c58-49d6-9e26-f4c7d3cbe20b.txt"),
  "utf8",
);
const rows = [];
for (const line of m49md.split(/\r?\n/)) {
  if (!line.startsWith("| 001 | World |")) continue;
  const cells = line.split("|").map((s) => s.trim());
  const c = cells.filter((_, i) => i > 0 && i < cells.length - 1);
  if (c.length < 12) continue;
  const country = c[8];
  const m49 = c[9];
  const iso2 = c[10];
  const iso3 = c[11];
  if (!country || !m49 || !/^\d{3}$/.test(m49)) continue;
  if (iso2 && !/^[A-Z]{2}$/.test(iso2)) continue;
  rows.push({
    globalCode: c[0],
    globalName: c[1],
    regionCode: c[2] || undefined,
    regionName: c[3] || undefined,
    subregionCode: c[4] || undefined,
    subregionName: c[5] || undefined,
    intermediateRegionCode: c[6] || undefined,
    intermediateRegionName: c[7] || undefined,
    countryOrArea: country,
    m49,
    isoAlpha2: iso2 || undefined,
    isoAlpha3: iso3 || undefined,
    ldc: c[12] === "x",
    lldc: c[13] === "x",
    sids: c[14] === "x",
  });
}

const seen = new Set();
const english = [];
for (const r of rows) {
  if (seen.has(r.m49)) continue;
  seen.add(r.m49);
  english.push(r);
}
console.log("m49 unique", english.length, "raw rows", rows.length);
if (english.length < 240) {
  throw new Error(`too few m49 rows: ${english.length}`);
}

const csvHeader = [
  "regionCode",
  "regionName",
  "subregionCode",
  "subregionName",
  "intermediateRegionCode",
  "intermediateRegionName",
  "countryOrArea",
  "m49",
  "isoAlpha2",
  "isoAlpha3",
  "ldc",
  "lldc",
  "sids",
];
const csvLines = [csvHeader.join(",")];
for (const r of english) {
  csvLines.push(
    csvHeader
      .map((k) => {
        const v = r[k];
        if (v === undefined || v === false) return "";
        if (v === true) return "x";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      })
      .join(","),
  );
}
fs.writeFileSync(path.join(ID, "un-m49.csv"), `${csvLines.join("\n")}\n`);
fs.writeFileSync(
  path.join(ID, "un-m49.json"),
  `${JSON.stringify(
    {
      source: "https://unstats.un.org/unsd/methodology/m49/overview/",
      language: "en",
      count: english.length,
      rows: english,
    },
    null,
    2,
  )}\n`,
);

function readDbf(file) {
  const buf = fs.readFileSync(file);
  const n = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields = [];
  let offset = 32;
  while (offset < headerLen - 1) {
    if (buf[offset] === 0x0d) break;
    const name = buf.slice(offset, offset + 11).toString("ascii").replace(/\0/g, "").trim();
    const type = String.fromCharCode(buf[offset + 11]);
    const flen = buf[offset + 16];
    fields.push({ name, type, len: flen });
    offset += 32;
  }
  const decoder = new TextDecoder("utf8");
  const clean = (s) => s.replace(/\0/g, "").trim();
  const records = [];
  for (let i = 0; i < n; i++) {
    const start = headerLen + i * recLen;
    let p = start + 1;
    const row = {};
    for (const f of fields) {
      row[f.name] = clean(decoder.decode(buf.slice(p, p + f.len)));
      p += f.len;
    }
    records.push(row);
  }
  return records;
}

const neKeep = [
  "ADM0_A3",
  "ADMIN",
  "NAME",
  "NAME_LONG",
  "FORMAL_EN",
  "TYPE",
  "SOV_A3",
  "SOVEREIGNT",
  "ISO_A2",
  "ISO_A2_EH",
  "ISO_A3",
  "ISO_A3_EH",
  "ISO_N3",
  "ISO_N3_EH",
  "UN_A3",
  "ADM0_ISO",
  "WIKIDATAID",
  "TINY",
  "LABELRANK",
  "NE_ID",
  "NAME_AR",
  "NAME_BN",
  "NAME_DE",
  "NAME_EL",
  "NAME_ES",
  "NAME_FA",
  "NAME_FR",
  "NAME_HE",
  "NAME_HI",
  "NAME_JA",
  "NAME_KO",
  "NAME_RU",
  "NAME_UK",
  "NAME_UR",
  "NAME_VI",
  "NAME_ZH",
  "NAME_ZHT",
];
const neRows = readDbf(
  path.join(ROOT, "data/raw/natural-earth/ne_50m_admin_0_countries.dbf"),
).map((r) => {
  const o = {};
  for (const k of neKeep) if (r[k]) o[k] = r[k];
  return o;
});
fs.writeFileSync(
  path.join(ID, "natural-earth-adm0.json"),
  `${JSON.stringify(
    {
      source: "Natural Earth 5.1.1 ne_50m_admin_0_countries (public domain)",
      sourceUrl: "https://github.com/nvkelso/natural-earth-vector/tree/v5.1.1/50m_cultural",
      count: neRows.length,
      rows: neRows,
    },
    null,
    2,
  )}\n`,
);

const dbf = fs.readFileSync(
  path.join(ROOT, "data/raw/natural-earth/ne_50m_admin_0_countries.dbf"),
);
const sha = crypto.createHash("sha256").update(dbf).digest("hex");
fs.writeFileSync(
  path.join(ROOT, "data/raw/natural-earth/ne_50m_admin_0_countries.dbf.sha256"),
  `${sha}  ne_50m_admin_0_countries.dbf\n`,
);
console.log("ne rows", neRows.length, "sha", sha);
console.log("done");
