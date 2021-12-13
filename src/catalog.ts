import puppeteer, { WaitForOptions } from "puppeteer";
import chalk from "chalk";

import { existJSON, writeJSON } from "./io";
import { PageRecord } from "./interface"

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = ".gdtm a";
const gotoOptions: WaitForOptions = { waitUntil: "domcontentloaded" }

const [, , key, targetUrl] = process.argv;

if (existJSON(key)) process.exit(0);

interface Refs {
  url: string;
  filename: string;
}

// aタグのNodeList
const getHrefs = async (page, query): Promise<Refs[]> =>
  await page.evaluate((selector) => {
    const links = document.querySelectorAll(selector);
    return [...links].map((link) => {
      const [, filename] = link.querySelector("img").title.split(": ")
      return { url: link.href, filename  }
    });
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

const uniq = (ary: string[]) => Array.from(new Set(ary));

(async () => {
  console.log("---- [1] Start cataloging ---------------");

  const browser = await puppeteer.launch()
  const page = await browser.newPage();

  try {
    await page.goto(`${targetUrl}?nw=always`, gotoOptions);

    const title = await page.evaluate(() => (document.getElementById("gj").innerText || document.title).trim());
  
    console.log("[Title] ", title);
  
    const pagenations = uniq(await getPagenations(page, PagenationSelector));
  
    const urls = [];
    for (const indexPage of pagenations) {
      if (indexPage !== targetUrl) {
        await page.goto(indexPage, gotoOptions);
      }
  
      urls.push(...(await getHrefs(page, ThumbnailSelector)));
    }

    browser.close();
    if (!urls.length) {
      console.error(chalk.red("Can't get urls!"));
      process.exit(1);
    }
  
    const pages: PageRecord[] = urls.map((url, i) => ({ page: i + 1, ...url, done: false }));
    const jsonPath = writeJSON(key, { title, size: pages.length, pages: pages });
  
    console.log("[OUT] ", jsonPath);
  } catch (err) {
    console.error(chalk.red("Can't catalog index page!"));
    process.exit(1);
  }

  console.log("---- [1] End ---------------");
})();
