import { mkdtemp, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp, { Region } from "sharp";
import pc from "picocolors";
import { ensureDir, resolveWorkPaths } from "../lib/file";
import { findCatalogEntry } from "../lib/catalog";

type Options = {
  out?: string;
  num?: string;
  dist?: string;
};

type ImagePart = {
  extract: Region;
};

const MAX_HEIGHT = 1600;
const TARGET_WIDTH_RATIO = 0.8;
const SPLIT_WIDTH_RATIO = 1.2;
const IMAGE_QUALITY = 50;

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

function getImageParts(width: number, height: number): ImagePart[] {
  // return [{ extract: { left: 520, top: 0, width: 1005, height } }];
  if (width < height * SPLIT_WIDTH_RATIO) {
    return [{ extract: { left: 0, top: 0, width, height } }];
  }

  const center = Math.floor(width / 2);
  const cropWidth = Math.min(center, Math.floor(height * TARGET_WIDTH_RATIO));

  return [
    { extract: { left: center, top: 0, width: cropWidth, height } },
    { extract: { left: center - cropWidth, top: 0, width: cropWidth, height } },
  ];
}

function getCenterCrop(region: Region): Region {
  const targetWidth = Math.min(region.width, Math.floor(region.height * TARGET_WIDTH_RATIO));
  const left = region.left + Math.floor((region.width - targetWidth) / 2);

  return {
    left,
    top: region.top,
    width: targetWidth,
    height: region.height,
  };
}

async function listImageFiles(dir: string): Promise<string[]> {
  const fileNames = await readdir(dir);
  const images: string[] = [];

  for (const fileName of fileNames) {
    const filePath = path.join(dir, fileName);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) continue;
    if (!imageExtensions.has(path.extname(fileName).toLowerCase())) continue;

    images.push(fileName);
  }

  return images.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function writeProcessedImage(inputPath: string, outputPath: string, region: Region): Promise<void> {
  const cropped = sharp(inputPath).extract(getCenterCrop(region)).jpeg({ quality: IMAGE_QUALITY });

  if (region.height > MAX_HEIGHT) {
    await cropped.resize({ height: MAX_HEIGHT }).toFile(outputPath);
    return;
  }

  await cropped.toFile(outputPath);
}

export const resolveDistPath = (targetPath: string): string => {
  const distDir = process.env.EHX_DIST_DIR;
  if (!distDir) return targetPath;

  if (targetPath.startsWith(distDir)) return targetPath;

  return path.join(distDir, targetPath);
};

export async function finishCommand(url: string | undefined, options: Options) {
  const catalogEntry = await findCatalogEntry(url);
  const prefixNum = options.num ?? catalogEntry?.num ?? "01";
  const dist = options.dist ?? process.env.EHX_DIST ?? "";
  const out = options.out ?? catalogEntry?.outDir;
  const { imageDir } = resolveWorkPaths(out);
  const outputDir = dist ? resolveDistPath(dist) : imageDir;

  await ensureDir(imageDir);

  const workDir = await mkdtemp(path.join(imageDir, ".finish-"));
  const inputFiles = await listImageFiles(imageDir);
  const outputFiles: string[] = [];
  let index = 1;

  await ensureDir(outputDir);

  try {
    for (const fileName of inputFiles) {
      const inputPath = path.join(imageDir, fileName);
      const metadata = await sharp(inputPath).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error(`image size could not be read: ${inputPath}`);
      }

      for (const part of getImageParts(metadata.width, metadata.height)) {
        const outputName = `${prefixNum}_${String(index).padStart(5, "0")}.jpg`;
        const outputPath = path.join(workDir, outputName);

        await writeProcessedImage(inputPath, outputPath, part.extract);
        outputFiles.push(outputName);
        index += 1;
      }
    }

    for (const fileName of inputFiles) {
      await unlink(path.join(imageDir, fileName));
    }

    for (const fileName of outputFiles) {
      await rename(path.join(workDir, fileName), path.join(outputDir, fileName));
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  console.log(pc.green(`---- [${out}] Finished => ${dist} -----`));
}
