import ProgressBar from "progress";
import pc from "picocolors";

import { launch } from "./puppeteer";
import { readJSON, writeJSON, saveFile, getImageNum } from "./io";

const [, , key] = process.argv;

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const data = readJSON(key);

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
  const bar = new ProgressBar("downloading [:bar] :current/:total (:percent) :etas", {
    incomplete: " ",
    total: targets.length,
    width: 30,
  });

  for (const record of targets) {
    if (!record.done) {
      try {
        const responseListener = async response => {
          try {
            const getFilename = (url: string) => {
              const funnyFileMatch = /.+\/([^\/]{1,}\-jpg)$/.exec(url);
              if (funnyFileMatch) return funnyFileMatch[1] + ".jpg";

              const matches = /.+\/([^\/]{1,}\.(jpg|png))$/.exec(response.url());
              if (!matches) return null;
              const filename = matches[1];

              // タイトルと実際の拡張子が異なる場合があるため、拡張子は無視する
              if (filename.replace(/\.(jpg|png)$/, "") !== record.filename.replace(/\.(jpg|png)$/, "")) return null;
              return filename;
            };
            const filename = getFilename(response.url());
            if (!filename) return;

            const buffer = await response.buffer();
            await saveFile(key, `${record.page.toString().padStart(3, "0")}_${filename}`, buffer);
          } catch (e) {}
        };
        page.on("response", responseListener);

        // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
        // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
        // "domcontentloaded" や "load" を試してみる。
        const response = await page.goto(record.url, { timeout: 20000, waitUntil: "networkidle0" });
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

  writeJSON(key, data);
  browser.close();

  const failures = data.pages.filter(({ done }) => !done);
  if (failures.length) {
    showEndLog(pc.red(`---- [${key}] End (some pages failed!) -----`));
    failures.forEach(({ page, url }) => {
      console.log(`${page}: ${url}`);
    });
    return;
  }

  if (getImageNum(key) === data.size) {
    showEndLog(pc.green(`---- [${key}] End (All pages completed!) -----`));
  } else {
    showEndLog(pc.red(`---- [${key}] End (some pages failed!) -----`));
  }
})();
