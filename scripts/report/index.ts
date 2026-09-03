/**
 * Coverage is written during data:normalize into data/generated/coverage.json
 * and published on /sources/.
 */
import fs from "node:fs";
import { COVERAGE_JSON } from "../lib/paths.ts";

if (!fs.existsSync(COVERAGE_JSON)) {
  console.error("coverage.json missing. Run pnpm data:normalize.");
  process.exitCode = 1;
} else {
  const report = JSON.parse(fs.readFileSync(COVERAGE_JSON, "utf8")) as {
    core: number;
    byIndicator: { indicatorId: string; fraction: number }[];
  };
  const hdi = report.byIndicator.find((r) => r.indicatorId === "hdi");
  console.log(`coverage core=${report.core} hdi=${hdi ? Math.round(hdi.fraction * 1000) / 10 : "n/a"}%`);
}
