import fs from "node:fs";
import YAML from "yaml";
import {
  entityCatalogSchema,
  indicatorCatalogSchema,
  precedenceTableSchema,
  type Entity,
  type EntityCatalog,
  type IndicatorCatalog,
  type IndicatorDefinition,
  type PrecedenceTable,
} from "@geo-index/schema";
import { ENTITIES_YAML, ETL_SOURCES_YAML, INDICATORS_YAML, PRECEDENCE_YAML } from "./paths.ts";

export type EtlSourceFilePin = {
  id?: string;
  url: string;
  filename: string;
  sha256?: string;
};

export type EtlSourcePin = {
  id: string;
  dataset: string;
  vintage: string;
  licenseId: string;
  estimateLastYear?: number;
  url?: string;
  filename?: string;
  sha256?: string;
  lastModified?: string;
  locTypeId?: string;
  bulkUrl?: string;
  seriesUrlTemplate?: string;
  bulkIndexUrl?: string;
  files?: EtlSourceFilePin[];
  notes?: string;
};

export type EtlSourcesFile = {
  userAgent?: string;
  asOfYear: number;
  sources: EtlSourcePin[];
};

export function loadEntities(): EntityCatalog {
  return entityCatalogSchema.parse(YAML.parse(fs.readFileSync(ENTITIES_YAML, "utf8")));
}

export function loadIndicators(): IndicatorCatalog {
  return indicatorCatalogSchema.parse(YAML.parse(fs.readFileSync(INDICATORS_YAML, "utf8")));
}

export function loadPrecedence(): PrecedenceTable {
  return precedenceTableSchema.parse(YAML.parse(fs.readFileSync(PRECEDENCE_YAML, "utf8")));
}

export function loadEtlSources(): EtlSourcesFile {
  return YAML.parse(fs.readFileSync(ETL_SOURCES_YAML, "utf8")) as EtlSourcesFile;
}

export function codesFromCatalog(indicators: IndicatorDefinition[], sourceId: string): string[] {
  const codes = new Set<string>();
  for (const ind of indicators) {
    if (ind.preferredSource === sourceId) codes.add(ind.sourceIndicatorId);
    for (const fb of ind.fallbacks) {
      if (fb.sourceId === sourceId) codes.add(fb.sourceIndicatorId);
    }
  }
  return [...codes].sort();
}

export function wdiCodesFromCatalog(indicators: IndicatorDefinition[]): string[] {
  return codesFromCatalog(indicators, "world-bank-wdi");
}

export function wppColumnsFromCatalog(indicators: IndicatorDefinition[]): Map<string, IndicatorDefinition> {
  const map = new Map<string, IndicatorDefinition>();
  for (const ind of indicators) {
    if (ind.preferredSource === "un-wpp") map.set(ind.sourceIndicatorId, ind);
  }
  return map;
}

export function sourceOrder(precedence: PrecedenceTable, indicatorId: string): string[] | undefined {
  return precedence.rules.find((r) => r.indicatorId === indicatorId)?.sources;
}

export function entityList(catalog: EntityCatalog): Entity[] {
  return catalog.entities;
}
