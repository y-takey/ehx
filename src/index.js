const fs = require("fs");
// const mkdirp = require("mkdirp");
const puppeteer = require("puppeteer");

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = ".gdtm a";

const target = process.argv[2];
const outDir = `${process.cwd()}/tmp`;

console.log("---- Start Downloading ---------------");
console.log("from page:", target);
console.log("out dir:", outDir);

// WorkFlow:
//   1. コマンド引数から対象ファイルのサムネイル一覧ページを取得
//   2. サムネイル一覧からダウンロードすべき全URLを収集
//   3. 全画像をダウンロード

const saveFile = async (filename, content) => {
  fs.writeFile(`${outDir}/${filename}`, content, err => {
    if (err) {
      console.log("XXXXXX failed to save file XXXXXX");
      console.log(err);
      console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    }
  });
};

// aタグのNodeList
const getHrefs = async (page, query) =>
  await page.evaluate(selector => {
    const links = document.querySelectorAll(selector);
    return [...links].map(link => link.href);
  }, query);

const uniq = ary => Array.from(new Set(ary));

// TODO: ダウンロードするURLの取得と、ダウンロード処理を分割する。
// 取得したURLはファイル等に書き出し、進捗管理＆リラン制御をしやすくする。
// ものによっては200ページくらいになるものもあるのでリラン時に全てをダウンロードするのではなく、
// 必要なもののみをダウンロードする。

puppeteer.launch().then(async browser => {
  const page = await browser.newPage();
  //   page.setViewport({ width: 1280, height: 926 });
  await page.goto(target, { waitUntil: "networkidle2" });

  const title = await page.evaluate(() => document.title.trim());
  // const title = await page.evaluate(() => document.getElementById("gj").innerText.trim());

  // TODO: 対象毎に作業ディレクトリを作成する
  // mkdirpを使わず、もうちょっと簡単にできるかも
  // https://stackoverflow.com/questions/16316330/how-to-write-file-if-parent-folder-doesnt-exist

  // mkdirp(getDirName(path), function (err) {
  //   if (err) return cb(err);

  //   fs.writeFile(path, contents, cb);
  // });

  console.log("title:", title);
  const pagenations = uniq(await getHrefs(page, PagenationSelector));

  const urls = [];
  for (const indexPage of pagenations) {
    if (indexPage !== target) {
      await page.goto(indexPage, { waitUntil: "networkidle0" });
    }

    urls.push(...(await getHrefs(page, ThumbnailSelector)));
  }

  console.log("all urls:", urls.length);

  page.on("response", async response => {
    const matches = /\d{3}\.jpg$/.exec(response.url());

    if (!matches) return;

    // console.log("image:", matches[0]);
    const buffer = await response.buffer();
    saveFile(matches[0], buffer);
  });

  // テスト用に最初の数件だけ
  // const targetUrls = urls.slice(0, 3);
  const targetUrls = urls;
  for (let i = 0; i < targetUrls.length; i++) {
    console.log(`[${i + 1}/${targetUrls.length}]`);
    // `{ waitUntil: "networkidle0" }` だと画像の保存が完了する前に終了することがあるため、
    // 完全にアイドル状態になるまで待機する。もしそれでも取りこぼしが発生する場合は、
    // "domcontentloaded" や "load" を試してみる。
    await page.goto(targetUrls[i], { waitUntil: "networkidle0" });
  }

  browser.close();
  console.log("---- End ---------------");
});
