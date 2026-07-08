import * as cheerio from "cheerio";
import pc from "picocolors";
import { readdir } from "node:fs/promises";
import { fetchHtml } from "../lib/fetcher";
import { writeJSON, readJSON, getDataKey } from "../lib/file";
import { Data, Page } from "../lib/types";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function renderProgress(dataKey: string, done: number, total: number) {
  const width = 40;
  const filled = Math.round((done / total) * width);

  const bar = "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";

  process.stdout.write(`\r${dataKey} ${bar} ${done}/${total}`);
}

async function getSavedPageNumbers(imageDir: string): Promise<Set<number>> {
  const fileNames = await readdir(imageDir);
  const pages = new Set<number>();

  for (const fileName of fileNames) {
    const match = fileName.match(/^(\d{4})_/);
    if (!match) continue;

    pages.add(Number(match[1]));
  }

  return pages;
}

async function syncDoneWithSavedImages(dataPath: string, imageDir: string, data: Data): Promise<string> {
  const savedPages = await getSavedPageNumbers(imageDir);

  for (const page of data.pages) {
    page.done = savedPages.has(page.page);
  }

  await writeJSON(dataPath, data);

  console.log("");

  const failures = data.pages.filter(({ done }) => !done);
  if (failures.length) {
    failures.slice(0, 5).forEach(({ page, url }) => {
      console.log(`${page}: ${url}`);
    });
    return pc.red(`${failures.length} pages failed!`);
  }

  if (savedPages.size === data.size) {
    return pc.green(`All pages completed!`);
  } else {
    return pc.red(`some pages failed!, expected: ${data.size}, actual: ${savedPages.size})`);
  }
}

export async function downloadImages(dataPath: string, imageDir: string, concurrency: number): Promise<void> {
  const data: Data = (await readJSON(dataPath)) as Data;
  const dataKey = getDataKey(dataPath);
  const startTime = new Date();

  const queue = data.pages;
  const total = queue.length;

  for (const [index, page] of data.pages.entries()) {
    if (page.done) continue;

    // await sleep(1 * 1000);

    try {
      const waitSec = 30 * (page.times + 1);
      const html = await fetchHtml(page.url, waitSec);
      const $ = cheerio.load(html);

      const imgSrc = $("#img").attr("src");

      if (!imgSrc) throw new Error("img not found");

      const imgUrl = new URL(imgSrc, page.url).href;

      const res = await fetch(imgUrl);
      if (!res.ok) throw new Error(`image fetch failed`);

      const buffer = await res.arrayBuffer();

      const originalName = imgUrl.split("/").pop()?.split("?")[0] ?? "x.jpg";
      const fileName = `${String(page.page).padStart(4, "0")}_${originalName}`;

      const filePath = `${imageDir}/${fileName}`;

      await Bun.write(filePath, buffer);

      page.done = true;
    } catch (e) {
      page.times += 1;
    }

    await writeJSON(dataPath, data);

    renderProgress(dataKey, index + 1, total);
  }

  const message = await syncDoneWithSavedImages(dataPath, imageDir, data);
  const endTime = new Date();
  const during = (endTime.getTime() - startTime.getTime()) / 1000;
  const hash = data.url.split("/").at(-2);

  console.log(
    `--- ${pc.blue(dataKey)}(${hash}) End ${endTime.toLocaleString()} (${Math.round(during)}sec) ---: ${message}`,
  );
}

// export async function downloadImages(dataPath: string, imageDir: string, concurrency: number): Promise<void> {
//   const data: Data = (await readJSON(dataPath)) as Data;

//   const queue = data.pages;
//   const total = queue.length;

//   async function worker(id: number) {
//     while (true) {
//       const page = queue.find(p => !p.done);
//       if (!page) break;

//       // 他workerとの競合を避けるため仮ロック
//       page.done = true;

//       try {
//         // const waitSec = 30 * (page.times + 1);
//         const waitSec = 1;
//         // console.log(`[W${id}] page=${page.page} wait ${waitSec}s (retry=${page.times})`);

//         await sleep(waitSec * 1000);

//         const html = await fetchHtml(page.url);
//         const $ = cheerio.load(html);

//         const imgSrc = $("#img").attr("src");
//         if (!imgSrc) throw new Error("img not found");

//         const imgUrl = new URL(imgSrc, page.url).href;

//         const res = await fetch(imgUrl);
//         if (!res.ok) throw new Error("image fetch failed");

//         const buffer = await res.arrayBuffer();

//         const originalName = imgUrl.split("/").pop()?.split("?")[0] ?? "x.jpg";
//         const fileName = `${String(page.page).padStart(4, "0")}_${originalName}`;

//         const filePath = `${imageDir}/${fileName}`;

//         await Bun.write(filePath, buffer);

//         // console.log(`[W${id}] saved: ${fileName}`);
//       } catch (e) {
//         page.done = false; // 失敗時は戻す
//         page.times += 1;

//         // console.warn(`[W${id}] failed: ${page.url}`);
//       }

//       // 状態保存
//       await writeJSON(dataPath, data);

//       renderProgress(data.pages, total);
//     }
//   }

//   await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));

//   console.log("\nAll done");
// }
