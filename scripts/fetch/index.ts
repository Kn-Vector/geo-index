/**
 * Fetch recorded upstream snapshots: WPP, WDI, HDR, UIS, ILOSTAT, IMF WEO, OWID CO2.
 * Identifier SPARQL refresh: pass --identifiers.
 */
import { fetchWpp } from "./wpp.ts";
import { fetchWdi } from "./wdi.ts";
import { fetchHdr } from "./hdr.ts";
import { fetchUis } from "./uis.ts";
import { fetchIlo } from "./ilo.ts";
import { fetchImf } from "./imf.ts";
import { fetchOwid } from "./owid.ts";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "../lib/paths.ts";

const force = process.argv.includes("--force") || process.argv.includes("--update-checksums");
const identifiers = process.argv.includes("--identifiers");

async function main(): Promise<void> {
  console.log("data:fetch — WPP + WDI + HDR + UIS + ILO + IMF WEO + OWID CO2");
  const [wpp, wdi, hdr, uis, ilo, imf, owid] = await Promise.all([
    fetchWpp(force),
    fetchWdi(force),
    fetchHdr(force),
    fetchUis(force),
    fetchIlo(force),
    fetchImf(force),
    fetchOwid(force),
  ]);
  if (identifiers) {
    const queryFile = path.join(ROOT, "scripts/fetch/wikidata-native-names.rq");
    const outFile = path.join(ROOT, "data/raw/identifiers/wikidata-native-names.json");
    const result = spawnSync(
      "curl",
      [
        "-sS",
        "-A",
        "GeoIndex/0.1 (world atlas identifier crosswalk)",
        "-H",
        "Accept: application/sparql-results+json",
        "--data-urlencode",
        `query@${queryFile}`,
        "https://query.wikidata.org/sparql",
        "-o",
        outFile,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      console.warn("Wikidata SPARQL fetch failed; existing snapshot kept.");
    }
  }
  const blockers = [wpp.blocker, wdi.blocker, hdr.blocker, uis.blocker, ilo.blocker, imf.blocker, owid.blocker].filter(
    Boolean,
  );
  if (blockers.length) {
    console.warn("Fetch completed with blockers. Normalize will emit empty observations, not invented values.");
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
