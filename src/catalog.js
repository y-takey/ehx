const puppeteer = require("puppeteer");

const { writeJSON } = require("./io.js");

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = ".gdtm a";

const [, , key, targetUrl] = process.argv;

// aタグのNodeList
const getHrefs = async (page, query) =>
  await page.evaluate(selector => {
    const links = document.querySelectorAll(selector);
    return [...links].map(link => link.href);
  }, query);

const uniq = ary => Array.from(new Set(ary));

puppeteer.launch().then(async browser => {
  console.log("---- [1] Start cataloging ---------------");
  const page = await browser.newPage();
  // query strong that avoid content warning
  await page.goto(`${targetUrl}?nw=always`, { waitUntil: "networkidle2" });

  const title = await page.evaluate(() => document.title.trim());
  // const title = await page.evaluate(() => document.getElementById("gj").innerText.trim());

  console.log("[Title] ", title);

  const pagenations = uniq(await getHrefs(page, PagenationSelector));

  const urls = [];
  for (const indexPage of pagenations) {
    if (indexPage !== targetUrl) {
      await page.goto(indexPage, { waitUntil: "networkidle0" });
    }

    urls.push(...uniq(await getHrefs(page, ThumbnailSelector)));
  }

  const data = urls.map((url, i) => ({ page: i + 1, url, done: false }));
  const jsonPath = writeJSON(key, { title, pages: data });

  browser.close();
  console.log("[OUT] ", jsonPath);
  console.log("---- [1] End ---------------");
});
