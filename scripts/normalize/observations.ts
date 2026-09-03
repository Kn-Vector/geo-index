import fs from "node:fs";
import path from "node:path";
import type {
  CoverageReport,
  DataManifest,
  Entity,
  EntityProfile,
  IndicatorDefinition,
  Observation,
  SourceVintage,
} from "@geo-index/schema";
import {
  loadEntities,
  loadEtlSources,
  loadIndicators,
  loadPrecedence,
  sourceOrder,
  wppColumnsFromCatalog,
} from "../lib/catalogs.ts";
import { buildEntityIndex } from "../lib/join.ts";
import {
  COVERAGE_JSON,
  GENERATED_ENTITIES_DIR,
  HDR_META,
  ILO_META,
  IMF_META,
  MANIFEST_JSON,
  NORMALIZED_DIR,
  OWID_META,
  UNESCO_META,
  WDI_META,
  WPP_GZ,
  WPP_META,
} from "../lib/paths.ts";
import { parseWpp, wppObservation, type EntityWpp } from "./wpp.ts";
import { parseWdiFiles, wdiObservation, type EntityWdi } from "./wdi.ts";
import { hdrObservation, parseHdr } from "./hdr.ts";
import { parseUis, uisObservation } from "./uis.ts";
import { iloObservation, parseIlo } from "./ilo.ts";
import { imfObservation, parseImf } from "./imf.ts";
import { owidObservation, parseOwid } from "./owid.ts";
import type { FetchMeta } from "../fetch/wpp.ts";
import type { WdiFetchMeta } from "../fetch/wdi.ts";
import type { HdrFetchMeta } from "../fetch/hdr.ts";
import type { UisFetchMeta } from "../fetch/uis.ts";
import type { IloFetchMeta } from "../fetch/ilo.ts";
import type { ImfFetchMeta } from "../fetch/imf.ts";
import type { OwidFetchMeta } from "../fetch/owid.ts";
import { isImplausibleZero } from "../lib/values.ts";
import type { EntitySourceBag, GenericFetchMeta, SourceSeries } from "../lib/series.ts";

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function fallbackMeta(id: string, extra: Partial<GenericFetchMeta> = {}): GenericFetchMeta {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === id);
  return {
    sourceId: id,
    dataset: pin?.dataset ?? id,
    vintage: pin?.vintage ?? "unknown",
    url: pin?.url ?? pin?.bulkUrl ?? pin?.seriesUrlTemplate ?? "",
    filename: pin?.filename,
    sha256: pin?.sha256,
    retrievedAt: pin?.lastModified ?? new Date().toISOString(),
    skipped: true,
    licenseId: pin?.licenseId ?? "unknown",
    estimateLastYear: pin?.estimateLastYear,
    blocker: extra.blocker,
    ...extra,
  };
}

function fallbackWppMeta(): FetchMeta {
  const base = fallbackMeta("un-wpp", {
    blocker: fs.existsSync(WPP_GZ) ? undefined : "WPP snapshot is missing. Run pnpm data:fetch.",
  });
  return { ...base, sourceId: "un-wpp", bytes: fs.existsSync(WPP_GZ) ? fs.statSync(WPP_GZ).size : 0, skipped: true };
}

function fallbackWdiMeta(): WdiFetchMeta {
  const pins = loadEtlSources();
  const pin = pins.sources.find((s) => s.id === "world-bank-wdi")!;
  return {
    sourceId: "world-bank-wdi",
    dataset: pin.dataset,
    vintage: pin.vintage,
    retrievedAt: new Date().toISOString(),
    licenseId: pin.licenseId,
    mode: "series",
    seriesUrlTemplate: pin.seriesUrlTemplate ?? "",
    series: [],
    blocker: "WDI fetch-meta.json is missing. Run pnpm data:fetch.",
  };
}

function observeBag(
  entity: Entity,
  indicator: IndicatorDefinition,
  bag: EntitySourceBag | undefined,
  asOfYear: number,
  meta: GenericFetchMeta,
  build: (
    entity: Entity,
    indicator: IndicatorDefinition,
    series: SourceSeries,
    asOfYear: number,
    meta: GenericFetchMeta,
  ) => Observation | null,
): Observation[] {
  const seriesList = bag?.get(indicator.id) ?? [];
  const out: Observation[] = [];
  for (const series of seriesList) {
    const obs = build(entity, indicator, series, asOfYear, meta);
    if (obs && obs.value != null) out.push(obs);
  }
  return out;
}

function pickPreferred(
  entity: Entity,
  indicator: IndicatorDefinition,
  wpp: EntityWpp | undefined,
  wdi: EntityWdi | undefined,
  bags: Record<string, EntitySourceBag | undefined>,
  asOfYear: number,
  wppMeta: FetchMeta,
  wdiMeta: WdiFetchMeta,
  metas: Record<string, GenericFetchMeta>,
  precedence: string[],
): { primary: Observation | null; alternates: Observation[] } {
  const candidates: { sourceId: string; obs: Observation }[] = [];
  const wppPoints = wpp?.get(indicator.id);
  if (wppPoints) {
    const obs = wppObservation(entity, indicator, wppPoints.points, asOfYear, wppMeta);
    if (obs && obs.value != null) candidates.push({ sourceId: "un-wpp", obs });
  }
  const wdiSeries = wdi?.get(indicator.id) ?? [];
  for (const series of wdiSeries) {
    const obs = wdiObservation(entity, series, asOfYear, wdiMeta);
    if (obs && obs.value != null) candidates.push({ sourceId: "world-bank-wdi", obs });
  }

  const builders: Record<
    string,
    (
      entity: Entity,
      indicator: IndicatorDefinition,
      series: SourceSeries,
      asOfYear: number,
      meta: GenericFetchMeta,
    ) => Observation | null
  > = {
    "undp-hdr": hdrObservation,
    "unesco-uis": uisObservation,
    "ilo-stat": iloObservation,
    "imf-weo": imfObservation,
    "owid-co2": owidObservation,
  };
  for (const [sourceId, build] of Object.entries(builders)) {
    const meta = metas[sourceId];
    if (!meta) continue;
    for (const obs of observeBag(entity, indicator, bags[sourceId], asOfYear, meta, build)) {
      candidates.push({ sourceId, obs });
    }
  }

  const order = precedence.length
    ? precedence
    : [indicator.preferredSource, ...indicator.fallbacks.map((f) => f.sourceId)];
  let primary: Observation | null = null;
  const alternates: Observation[] = [];
  const used = new Set<string>();
  for (const sourceId of order) {
    const hit = candidates.find((c) => c.sourceId === sourceId && !used.has(c.sourceId + c.obs.originalIndicatorId));
    if (!hit) continue;
    used.add(hit.sourceId + hit.obs.originalIndicatorId);
    if (!primary) primary = hit.obs;
    else alternates.push(hit.obs);
  }
  for (const c of candidates) {
    if (!used.has(c.sourceId + c.obs.originalIndicatorId)) {
      if (!primary) primary = c.obs;
      else alternates.push(c.obs);
    }
  }
  return { primary, alternates };
}

function profileOf(
  entity: Entity,
  observations: Observation[],
  alternates: Observation[],
  generatedAt: string,
): EntityProfile {
  const byId = new Map(observations.map((o) => [o.indicatorId, o]));
  return {
    entityId: entity.id,
    commonName: entity.commonName,
    isoAlpha2: entity.isoAlpha2,
    isoAlpha3: entity.isoAlpha3,
    m49: entity.m49,
    classification: entity.classification,
    tier: entity.tier,
    generatedAt,
    headlines: {
      population: byId.get("population") ?? null,
      gdp: byId.get("gdp") ?? null,
      gdpPerCapita: byId.get("gdp-per-capita") ?? null,
      hdi: byId.get("hdi") ?? null,
      lifeExpectancy: byId.get("life-expectancy") ?? null,
      area: byId.get("land-area") ?? null,
    },
    observations,
    alternates,
  };
}

function vintageOf(meta: GenericFetchMeta | { blocker?: string; vintage: string }): string | null {
  return meta.blocker ? null : meta.vintage;
}

export async function normalizeObservations(): Promise<{
  manifest: DataManifest;
  coverage: CoverageReport;
  blockers: string[];
}> {
  const generatedAt = new Date().toISOString();
  const entities = loadEntities();
  const indicators = loadIndicators();
  const precedence = loadPrecedence();
  const pins = loadEtlSources();
  const asOfYear = pins.asOfYear;
  const index = buildEntityIndex(entities.entities);
  const wppMeta = readJson<FetchMeta>(WPP_META) ?? fallbackWppMeta();
  const wdiMeta = readJson<WdiFetchMeta>(WDI_META) ?? fallbackWdiMeta();
  const hdrMeta = (readJson<HdrFetchMeta>(HDR_META) ?? fallbackMeta("undp-hdr", { blocker: "HDR fetch-meta.json is missing. Run pnpm data:fetch." })) as HdrFetchMeta;
  const uisMeta = (readJson<UisFetchMeta>(UNESCO_META) ?? fallbackMeta("unesco-uis", { blocker: "UIS fetch-meta.json is missing. Run pnpm data:fetch." })) as UisFetchMeta;
  const iloMeta = (readJson<IloFetchMeta>(ILO_META) ?? fallbackMeta("ilo-stat", { blocker: "ILO fetch-meta.json is missing. Run pnpm data:fetch." })) as IloFetchMeta;
  const imfMeta = (readJson<ImfFetchMeta>(IMF_META) ?? fallbackMeta("imf-weo", { blocker: "IMF fetch-meta.json is missing. Run pnpm data:fetch." })) as ImfFetchMeta;
  const owidMeta = (readJson<OwidFetchMeta>(OWID_META) ?? fallbackMeta("owid-co2", { blocker: "OWID fetch-meta.json is missing. Run pnpm data:fetch." })) as OwidFetchMeta;

  const blockers: string[] = [];
  const pushBlocker = (label: string, blocker?: string) => {
    if (blocker) blockers.push(`${label}: ${blocker}`);
  };
  pushBlocker("WPP", wppMeta.blocker);
  pushBlocker("WDI", wdiMeta.blocker);
  pushBlocker("HDR", hdrMeta.blocker);
  pushBlocker("UIS", uisMeta.blocker);
  pushBlocker("ILO", iloMeta.blocker);
  pushBlocker("IMF", imfMeta.blocker);
  pushBlocker("OWID", owidMeta.blocker);
  if (hdrMeta.mpi?.blocker) blockers.push(`HDR MPI: ${hdrMeta.mpi.blocker}`);
  blockers.push(
    "HDR MPI 2025 tables have no ISO3/M49 column; skipped rather than joining on English names.",
  );

  const estimateLastYear = pins.sources.find((s) => s.id === "un-wpp")?.estimateLastYear ?? 2023;
  const iloCutoff = pins.sources.find((s) => s.id === "ilo-stat")?.estimateLastYear ?? 2025;
  const weoCutoff = pins.sources.find((s) => s.id === "imf-weo")?.estimateLastYear ?? 2025;
  const wppColumns = wppColumnsFromCatalog(indicators.indicators);

  let wppData = new Map<string, EntityWpp>();
  if (fs.existsSync(WPP_GZ) && !wppMeta.blocker) {
    wppData = await parseWpp(index, wppColumns, wppMeta, estimateLastYear);
    console.log(`WPP: parsed ${wppData.size} entities`);
  } else if (!fs.existsSync(WPP_GZ)) {
    blockers.push("WPP snapshot missing; population/demography observations are empty.");
  }

  const wdiData = parseWdiFiles(index, indicators.indicators);
  console.log(`WDI: parsed ${wdiData.size} entities`);

  const hdrData = await parseHdr(index, indicators.indicators);
  console.log(`HDR: parsed ${hdrData.size} entities`);
  const uisData = await parseUis(index, indicators.indicators);
  console.log(`UIS: parsed ${uisData.size} entities`);
  const iloData = await parseIlo(index, indicators.indicators, iloCutoff);
  console.log(`ILO: parsed ${iloData.size} entities`);
  const imfData = await parseImf(index, indicators.indicators, weoCutoff);
  console.log(`IMF: parsed ${imfData.size} entities`);
  const owidData = await parseOwid(index, indicators.indicators);
  console.log(`OWID: parsed ${owidData.size} entities`);

  const bags: Record<string, Map<string, EntitySourceBag>> = {
    "undp-hdr": hdrData,
    "unesco-uis": uisData,
    "ilo-stat": iloData,
    "imf-weo": imfData,
    "owid-co2": owidData,
  };
  const metas: Record<string, GenericFetchMeta> = {
    "undp-hdr": hdrMeta,
    "unesco-uis": uisMeta,
    "ilo-stat": iloMeta,
    "imf-weo": imfMeta,
    "owid-co2": owidMeta,
  };

  fs.mkdirSync(GENERATED_ENTITIES_DIR, { recursive: true });
  fs.mkdirSync(NORMALIZED_DIR, { recursive: true });

  const coverageMap = new Map<string, { coreWithValue: number }>();
  for (const ind of indicators.indicators) coverageMap.set(ind.id, { coreWithValue: 0 });

  const core = entities.entities.filter((e) => e.tier === "core");
  const additional = entities.entities.filter((e) => e.tier === "profiled-additional");

  for (const entity of entities.entities) {
    const observations: Observation[] = [];
    const alternates: Observation[] = [];
    for (const indicator of indicators.indicators) {
      const order = sourceOrder(precedence, indicator.id) ?? [
        indicator.preferredSource,
        ...indicator.fallbacks.map((f) => f.sourceId),
      ];
      const picked = pickPreferred(
        entity,
        indicator,
        wppData.get(entity.id),
        wdiData.get(entity.id),
        {
          "undp-hdr": bags["undp-hdr"]?.get(entity.id),
          "unesco-uis": bags["unesco-uis"]?.get(entity.id),
          "ilo-stat": bags["ilo-stat"]?.get(entity.id),
          "imf-weo": bags["imf-weo"]?.get(entity.id),
          "owid-co2": bags["owid-co2"]?.get(entity.id),
        },
        asOfYear,
        wppMeta,
        wdiMeta,
        metas,
        order,
      );
      if (picked.primary) {
        if (picked.primary.value != null && isImplausibleZero(indicator.id, picked.primary.value)) {
          throw new Error(
            `Refusing 0-for-null: ${entity.id} ${indicator.id} is 0 from ${picked.primary.sourceId}`,
          );
        }
        observations.push(picked.primary);
        if (entity.tier === "core" && picked.primary.value != null) {
          coverageMap.get(indicator.id)!.coreWithValue += 1;
        }
      }
      alternates.push(...picked.alternates);
    }
    const profile = profileOf(entity, observations, alternates, generatedAt);
    fs.writeFileSync(
      path.join(GENERATED_ENTITIES_DIR, `${entity.id}.json`),
      JSON.stringify(profile),
    );
  }

  const sourceVintage = (meta: GenericFetchMeta): SourceVintage => ({
    sourceId: meta.sourceId,
    dataset: meta.dataset,
    vintage: meta.vintage,
    retrievedAt: meta.retrievedAt,
    url: meta.url || "local",
    sha256: meta.sha256,
    licenseId: meta.licenseId,
    blocker: meta.blocker,
  });

  const sources: SourceVintage[] = [
    sourceVintage(wppMeta),
    {
      sourceId: "world-bank-wdi",
      dataset: wdiMeta.dataset,
      vintage: wdiMeta.vintage,
      retrievedAt: wdiMeta.retrievedAt,
      url: wdiMeta.seriesUrlTemplate,
      licenseId: wdiMeta.licenseId,
      blocker: wdiMeta.blocker,
    },
    sourceVintage(hdrMeta),
    sourceVintage(uisMeta),
    sourceVintage(iloMeta),
    sourceVintage(imfMeta),
    sourceVintage(owidMeta),
  ];

  const manifest: DataManifest = {
    generatedAt,
    asOfYear,
    entityCount: entities.entities.length,
    coreProfiles: core.length,
    vintages: {
      wpp: vintageOf(wppMeta),
      wdi: wdiMeta.blocker ? null : wdiMeta.vintage,
      hdr: vintageOf(hdrMeta),
      uis: vintageOf(uisMeta),
      ilo: vintageOf(iloMeta),
      weo: vintageOf(imfMeta),
      owid: vintageOf(owidMeta),
      naturalEarth: "5.1.1",
    },
    sources,
    indicators: indicators.indicators.map((i) => i.id),
    blockers,
    joinKeys: ["id", "isoAlpha3", "isoAlpha2", "m49"],
  };

  const coverage: CoverageReport = {
    generatedAt,
    core: core.length,
    profiledAdditional: additional.length,
    byIndicator: indicators.indicators.map((ind) => {
      const hit = coverageMap.get(ind.id)!.coreWithValue;
      return {
        indicatorId: ind.id,
        coreWithValue: hit,
        core: core.length,
        fraction: core.length ? hit / core.length : 0,
      };
    }),
  };

  fs.writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(COVERAGE_JSON, JSON.stringify(coverage, null, 2));
  fs.writeFileSync(
    path.join(NORMALIZED_DIR, "README.md"),
    "Observations live on per-entity JSON under data/generated/entities/. This folder is a stub for later parquet dumps.\n",
  );

  console.log(`Wrote ${entities.entities.length} profiles to ${path.relative(process.cwd(), GENERATED_ENTITIES_DIR)}`);
  if (blockers.length) {
    console.warn("Blockers:");
    for (const b of blockers) console.warn(`  - ${b}`);
  }
  return { manifest, coverage, blockers };
}
