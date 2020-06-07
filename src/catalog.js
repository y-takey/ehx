const puppeteer = require("puppeteer");

const { writeJSON } = require("./io.js");

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = ".gdtm a";

const [, , key, targetUrl] = process.argv;

// aタグのNodeList
const getHrefs = async (page, query) =>
  await page.evaluate((selector) => {
    const links = document.querySelectorAll(selector);
    return [...links].map((link) => link.href);
  }, query);

const getPagenations = async (page, query) =>
  await page.evaluate((selector) => {
    const basePath = document.location.href;
    const result = [basePath];
    const links = document.querySelectorAll(selector);
    const pages = [...links].map((link) => Number(link.innerText)).filter((num) => !Number.isNaN(num));
    const lastPage = Number(pages[pages.length - 1]);
    if (lastPage !== 1) {
      [...Array(lastPage - 1)].forEach((_, i) => result.push(`${basePath}?p=${i + 1}`));
    }
    return result;
  }, query);

const uniq = (ary) => Array.from(new Set(ary));

puppeteer.launch().then(async (browser) => {
  console.log("---- [1] Start cataloging ---------------");
  const page = await browser.newPage();
  // query strong that avoid content warning
  await page.goto(`${targetUrl}?nw=always`, { waitUntil: "networkidle2" });

  const title = await page.evaluate(() => document.title.trim());
  // const title = await page.evaluate(() => document.getElementById("gj").innerText.trim());

  console.log("[Title] ", title);

  const pagenations = uniq(await getPagenations(page, PagenationSelector));

  const urls = [];
  for (const indexPage of pagenations) {
    if (indexPage !== targetUrl) {
      await page.goto(indexPage, { waitUntil: "networkidle0" });
    }

    urls.push(...uniq(await getHrefs(page, ThumbnailSelector)));
  }

  const data = urls.map((url, i) => ({ page: i + 1, url, done: false }));
  const jsonPath = writeJSON(key, { title, size: data.length, pages: data });

  browser.close();
  console.log("[OUT] ", jsonPath);
  console.log("---- [1] End ---------------");
});
