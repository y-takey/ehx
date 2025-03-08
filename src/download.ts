import ProgressBar from "progress";
import pc from "picocolors";
import { HTTPResponse } from "puppeteer";

import { launch } from "./puppeteer";
import { readJSON, writeJSON, saveFile, getImageNum, imageExt, getImageFileNames } from "./io";

const timeoutMS = 4 * 1000;
const [, , key] = process.argv;

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const data = readJSON(key);

const withoutExt = (name: string) => name.replace(new RegExp(imageExt), "");

const getTargetFilename = (response: HTTPResponse, expectedFilename: string): string | null => {
  const url = response.url();
  if (url.includes("ads.")) return null;
  const headers = response.headers();
  const contentType = headers["content-type"];
  if (!contentType?.startsWith("image/")) return null;
  const actualFilename = url.split("/").at(-1);
  const actualFilenamePartial = withoutExt(actualFilename);
  const expectedFilenamePartial = withoutExt(expectedFilename);

  if (!actualFilenamePartial) return actualFilename;

  if (actualFilenamePartial === expectedFilenamePartial) return actualFilename;

  // const length = Number(headers["content-length"]);
  // if (length < 10000) return null;

  return null;
};

const createResponseListener = (page: number, filename: string) => async (response: HTTPResponse) => {
  try {
    const targetFilename = getTargetFilename(response, filename);
    if (!targetFilename) return;

    const buffer = await response.buffer();

    await saveFile(key, `${page.toString().padStart(3, "0")}_${targetFilename}`, buffer);
  } catch (e) {}
};

(async () => {
  const startTime = new Date();
  const showEndLog = (text: string) => {
    const endTime = new Date();
    const during = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`${text} ${startTime.toLocaleString()} - ${endTime.toLocaleTimeString()} (${Math.round(during)}s)`);
  };

  // console.log("---- [2] Start Downloading ---------------");
  const browser = await launch();
  const page = await browser.newPage();
  // page.setViewport({ width: 1280, height: 926 });

  const targets = data.pages;
  const bar = new ProgressBar(`downloading [:bar] ${key} :current/:total (:percent) :etas`, {
    incomplete: " ",
    total: targets.length,
    width: 30,
  });

  for (const record of targets) {
    if (!record.done) {
      record.times = record.times + 1;
      try {
        const responseListener = createResponseListener(record.page, record.filename);
        page.on("response", responseListener);

        // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
        // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
        // "domcontentloaded" や "load" を試してみる。
        const response = await page.goto(record.url, { timeout: timeoutMS * record.times, waitUntil: "networkidle0" });
        await sleep(1000);
        page.off("response", responseListener);

        if (response.status() === 200) {
          record.done = true;
        }
      } catch (err) {
        // 当該のページのダウンロードはスキップし、次のページのダウンロードを継続する。
      }
    }
    bar.tick();
  }

  const existPages = Object.fromEntries(getImageFileNames(key).map(filename => [Number(filename.slice(0, 3)), true]));
  for (const record of targets) {
    record.done = !!existPages[record.page];
  }

  writeJSON(key, data);
  browser.close();

  const failures = data.pages.filter(({ done }) => !done);
  if (failures.length) {
    failures.slice(0, 5).forEach(({ page, url }) => {
      console.log(`${page}: ${url}`);
    });
    showEndLog(pc.red(`---- [${key}] End (${failures.length} pages failed!) -----`));
    return;
  }

  if (getImageNum(key) === data.size) {
    showEndLog(pc.green(`---- [${key}] End (All pages completed!) -----`));
  } else {
    showEndLog(pc.red(`---- [${key}] End (some pages failed!) -----`));
  }
})();
