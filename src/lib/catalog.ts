import path from "node:path";
import { ensureDir, existsFile, getWorkDir, readJSON, writeJSON } from "./file";

export type CatalogEntry = {
  group: string;
  num: string;
  outDir: string;
};

export type Catalog = Record<string, CatalogEntry>;

function getCatalogPath(): string {
  return path.join(getWorkDir(), "_meta", "_catalog.json");
}

async function readCatalog(): Promise<Catalog> {
  const catalogPath = getCatalogPath();

  if (!(await existsFile(catalogPath))) {
    return {};
  }

  return (await readJSON(catalogPath)) as Catalog;
}

async function writeCatalog(catalog: Catalog): Promise<void> {
  const catalogPath = getCatalogPath();

  await ensureDir(path.dirname(catalogPath));
  await writeJSON(catalogPath, catalog);
}

function getNextNum(catalog: Catalog, group: string): string {
  const maxNum = Object.values(catalog).reduce((max, entry) => {
    if (entry.group !== group) return max;

    const num = Number(entry.num);
    if (!Number.isFinite(num)) return max;

    return Math.max(max, num);
  }, 0);

  return String(maxNum + 1).padStart(2, "0");
}

export async function findCatalogEntry(url: string | undefined): Promise<CatalogEntry | undefined> {
  if (!url) return undefined;

  const catalog = await readCatalog();

  return catalog[url];
}

export async function ensureCatalogEntry(url: string, group: string): Promise<CatalogEntry> {
  const catalog = await readCatalog();
  const existing = catalog[url];

  if (existing) {
    return existing;
  }

  const num = getNextNum(catalog, group);
  const entry: CatalogEntry = {
    group,
    num,
    outDir: `${group}${num}`,
  };

  catalog[url] = entry;
  await writeCatalog(catalog);

  return entry;
}
