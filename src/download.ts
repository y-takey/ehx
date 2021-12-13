import puppeteer from "puppeteer";
import ProgressBar from "progress";
import chalk from "chalk";

import { readJSON, writeJSON, saveFile, getImageNum } from "./io";

const [, , key] = process.argv;

const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

const data = readJSON(key);

(async () => {
  // console.log("---- [2] Start Downloading ---------------");
  const browser = await puppeteer.launch()
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
        const responseListener = async (response) => {
          try {
            const matches = /.+\/([^\/]{1,}\.(jpg|png))$/.exec(response.url());
            if (!matches) return;
            const filename = matches[1];

            // タイトルと実際の拡張子が異なる場合があるため、拡張子は無視する
            if (filename.replace(/\.(jpg|png)$/, "") !== record.filename.replace(/\.(jpg|png)$/, "")) return;

            const buffer = await response.buffer();
            await saveFile(key, `${record.page.toString().padStart(3, "0")}_${filename}`, buffer);
              
          } catch (e) {}
        };
        page.on("response", responseListener)
      
        // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
        // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
        // "domcontentloaded" や "load" を試してみる。
        const response = await page.goto(record.url, { timeout: 20000, waitUntil: "networkidle0" });
        await sleep(1000);
        page.off("response", responseListener)

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
    console.log(chalk.red("---- End (some pages failed!) -----"));
    failures.forEach(({ page, url }) => {
      console.log(`${page}: ${url}`);
    });
    return
  }

  if (getImageNum(key) === data.size) {
    console.log(chalk.green("---- End (All pages completed!) -----"));
  } else {
    console.log(chalk.red("---- End (some pages failed!) -----"));
  }
})();
