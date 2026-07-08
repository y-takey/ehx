import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function existsFile(path: string): Promise<boolean> {
  try {
    await Bun.file(path).text();
    return true;
  } catch {
    return false;
  }
}

export async function writeJSON(path: string, data: object): Promise<number> {
  return await Bun.write(path, JSON.stringify(data, null, 2));
}

export async function readJSON(path: string): Promise<object> {
  return JSON.parse(await Bun.file(path).text());
}

export type WorkPaths = {
  dataPath: string;
  imageDir: string;
};

export function getWorkDir(): string {
  const workDir = process.env.EHX_WORK_DIR;

  if (!workDir) {
    throw new Error("EHX_WORK_DIR environment variable is required");
  }

  return workDir;
}

function getOutName(out?: string): string {
  const outName = out ?? "tst";

  if (
    !outName ||
    path.isAbsolute(outName) ||
    outName.includes("/") ||
    outName.includes("\\") ||
    outName === "." ||
    outName === ".."
  ) {
    throw new Error(`invalid out directory name: ${outName}`);
  }

  return outName;
}

export function resolveWorkPaths(out?: string): WorkPaths {
  const workDir = getWorkDir();
  const outName = getOutName(out);

  return {
    dataPath: path.join(workDir, "_meta", `${outName}.json`),
    imageDir: path.join(workDir, outName),
  };
}

export function getDataKey(dataPath: string): string {
  const dataKey = path.basename(dataPath, ".json");
  return `[${dataKey}]`;
}
