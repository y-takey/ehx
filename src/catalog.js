const puppeteer = require("puppeteer");
const chalk = require("chalk");

const { existJSON, writeJSON } = require("./io.js");

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = ".gdtm a";

const [, , key, targetUrl] = process.argv;

if (existJSON(key)) process.exit(0);

// aタグのNodeList
const getHrefs = async (page, query) =>
  await page.evaluate((selector) => {
    const links = document.querySelectorAll(selector);
    return [...links].map((link) => link.href);
  }, query);

const getPagenations = async (page, query) => {
  try {
    return await page.evaluate((selector) => {
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
  } catch (err) {
    return [];
  }
};

const uniq = (ary) => Array.from(new Set(ary));

puppeteer.launch().then(async (browser) => {
  console.log("---- [1] Start cataloging ---------------");
  const page = await browser.newPage();
  // query strong that avoid content warning
  try {
    // await page.goto(`${targetUrl}?nw=always`, { waitUntil: "networkidle2" });
    await page.goto(`${targetUrl}?nw=always`, { waitUntil: "domcontentloaded" });
  } catch (err) {
    console.error(chalk.red("Can't get index page!"));
    process.exit(1);
  }

  const title = await page.evaluate(() => document.title.trim());
  // const title = await page.evaluate(() => document.getElementById("gj").innerText.trim());

  console.log("[Title] ", title);

  const pagenations = uniq(await getPagenations(page, PagenationSelector));

  const urls = [];
  for (const indexPage of pagenations) {
    if (indexPage !== targetUrl) {
      // await page.goto(indexPage, { waitUntil: "networkidle0" });
      try {
        await page.goto(indexPage, { waitUntil: "domcontentloaded" });
      } catch (err) {
        console.error(chalk.red("Can't get index page! 2"));
        process.exit(1);
      }
    }

    urls.push(...uniq(await getHrefs(page, ThumbnailSelector)));
  }

  browser.close();
  if (!urls.length) {
    console.error(chalk.red("Can't get urls!"));
    process.exit(1);
  }

  const data = urls.map((url, i) => ({ page: i + 1, url, done: false }));
  const jsonPath = writeJSON(key, { title, size: data.length, pages: data });

  console.log("[OUT] ", jsonPath);
  console.log("---- [1] End ---------------");
});
