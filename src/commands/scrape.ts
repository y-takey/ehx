import path from "node:path";
import { ensureDir, resolveWorkPaths } from "../lib/file";
import { collectUrls } from "../lib/collector";
import { downloadImages } from "../lib/downloader";
import { ensureCatalogEntry } from "../lib/catalog";

type Options = {
  out?: string;
  group?: string;
  concurrency?: string;
  page?: string;
};

export async function scrapeCommand(url: string, options: Options) {
  const concurrency = Number(options.concurrency ?? 1);
  const page = options.page ?? "";
  const group = options.group ?? process.env.EHX_GROUP ?? "";
  const catalogEntry = await ensureCatalogEntry(url, group);
  const out = options.out ?? catalogEntry.outDir;
  const { dataPath, imageDir } = resolveWorkPaths(out);

  await ensureDir(path.dirname(dataPath));
  await ensureDir(imageDir);

  await collectUrls(url, dataPath, page);
  await downloadImages(dataPath, imageDir, concurrency);
}
