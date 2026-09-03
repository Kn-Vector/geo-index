export type DirectoryRow = {
  id: string;
  name: string;
  officialName: string;
  iso2?: string;
  iso3?: string;
  classification: string;
  tier: string;
  region?: string;
  subregion?: string;
  regionSlug?: string;
  subregionSlug?: string;
  population?: number | null;
  hdi?: number | null;
  lifeExpectancy?: number | null;
};

export type CompareObservation = {
  value: number | null;
  year: number;
  status: string;
  sourceId: string;
};

export type CompareEntity = {
  id: string;
  name: string;
  iso2?: string;
  iso3?: string;
  classification: string;
  observations: Record<string, CompareObservation>;
};
