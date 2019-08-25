const puppeteer = require("puppeteer");

const { readJSON, writeJSON, saveFile } = require("./io.js");

const [, , key] = process.argv;

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const data = readJSON(key);

puppeteer.launch().then(async browser => {
  console.log("---- [2] Start Downloading ---------------");
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
  for (let i = 0; i < targets.length; i++) {
    const { url, done } = targets[i];
    console.log(`[${i + 1}/${targets.length}]${done ? " (Skip)" : ""}`);
    if (done) continue;

    try {
      // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
      // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
      // "domcontentloaded" や "load" を試してみる。
      await page.goto(url, { timeout: 20000, waitUntil: "networkidle0" });
      await sleep(1000);
      targets[i].done = true;
    } catch (err) {
      // 当該のページのダウンロードはスキップし、次のページのダウンロードを継続する。
      // console.log(err.name + ': ' + err.message);
      // process.exit(-1);
    }
  }

  writeJSON(key, data);
  browser.close();

  const failures = data.pages.filter(({ done }) => !done);
  if (failures.length) {
    const failedNumbers = failures.map(({ page }) => page);
    console.log(`---- End (Failed pages : ${failedNumbers.join(", ")}) -----`);
  } else {
    console.log("---- End (All pages completed!) -----");
  }
});
