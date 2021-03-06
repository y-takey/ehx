const puppeteer = require("puppeteer");
const ProgressBar = require("progress");
const chalk = require("chalk");

const { readJSON, writeJSON, saveFile } = require("./io.js");

const [, , key] = process.argv;

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const data = readJSON(key);

puppeteer.launch().then(async browser => {
  // console.log("---- [2] Start Downloading ---------------");
  const page = await browser.newPage();
  // page.setViewport({ width: 1280, height: 926 });

  page.on("response", async response => {
    let matches = /.+\/([^\/]{2,}\.(jpg|png))$/.exec(response.url());

    if (!matches) {
      matches = /.+\/(\d{1,}\.(jpg|png))$/.exec(response.url());
      if (!matches) return;
    }
    const filename = matches[1];
    // Black list
    if (filename.includes("logo") || filename.includes("banner")) return;

    const buffer = await response.buffer();
    saveFile(key, filename, buffer);
  });

  const targets = data.pages;
  const bar = new ProgressBar("downloading [:bar] :current/:total (:percent) :etas", {
    incomplete: " ",
    total: targets.length,
    width: 30,
  });

  for (let i = 0; i < targets.length; i++) {
    const { url, done } = targets[i];
    // console.log(`[${i + 1}/${targets.length}]${done ? " (Skip)" : ""}`);
    if (!done) {
      try {
        // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
        // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
        // "domcontentloaded" や "load" を試してみる。
        const response = await page.goto(url, { timeout: 20000, waitUntil: "networkidle0" });
        if (response.status() === 200) {
          targets[i].done = true;
        }
        await sleep(1000);
      } catch (err) {
        // 当該のページのダウンロードはスキップし、次のページのダウンロードを継続する。
        // console.log(err.name + ': ' + err.message);
        // process.exit(-1);
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
  } else {
    console.log(chalk.green("---- End (All pages completed!) -----"));
  }
});
