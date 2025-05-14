import pc from "picocolors";
import yargs from "yargs/yargs";

import { launch, gotoOptions } from "./puppeteer";
import { existJSON, writeJSON } from "./io";
import { PageRecord } from "./interface";

const argv = yargs(process.argv.slice(2))
  .options({ p: { type: "string", default: "" } })
  .parseSync();
const [key, targetUrl] = argv._ as string[];
const isFiltered = argv.p;

const getTargetPages = (maxPage: number) => {
  const result = {};
  if (!argv.p) return result;

  argv.p.split(",").forEach(str => {
    const nums = str.split("-").map(Number);
    const startNum = nums[0] || 1;
    if (nums.length === 1) {
      result[startNum] = true;
    } else {
      const endNum = nums[1] || maxPage;
      const stepNum = nums[2] || 1;
      for (let num = startNum; num <= endNum; num = num + stepNum) {
        result[num] = true;
      }
    }
  });
  return result;
};

const filterPages = (allPages: PageRecord[]) => {
  if (!isFiltered) return allPages;
  const targetPages = getTargetPages(allPages.length);

  return allPages.filter(rec => targetPages[rec.page]);
};

const PagenationSelector = ".gtb .ptt a";
const ThumbnailSelector = "#gdt a";

if (existJSON(key)) process.exit(0);

interface Refs {
  url: string;
  filename: string;
}

// aタグのNodeList
const getHrefs = async (page, query): Promise<Refs[]> =>
  await page.evaluate(selector => {
    const links = document.querySelectorAll(selector);
    return [...links].map(link => {
      const [, filename] = link.querySelector("div").title.split(": ");
      return { url: link.href, filename };
    });
  }, query);

const getPagenations = async (page, query) => {
  try {
    return await page.evaluate(selector => {
      const basePath = document.location.href;
      const result = [basePath];
      const links = document.querySelectorAll(selector);
      const pages = [...links].map(link => Number(link.innerText)).filter(num => !Number.isNaN(num));
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
  const browser = await launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${targetUrl}?nw=always`, gotoOptions);

    const title = await page.evaluate(() => (document.getElementById("gj").innerText || document.title).trim());

    console.log("[Title] ", title);

    const pagenations = uniq(await getPagenations(page, PagenationSelector));

    const urls = [];
    for (const indexPage of pagenations) {
      if (indexPage !== targetUrl) {
        await page.goto(indexPage, { timeout: 20000, ...gotoOptions });
      }

      urls.push(...(await getHrefs(page, ThumbnailSelector)));
    }

    browser.close();
    if (!urls.length) {
      console.error(pc.red("Can't get urls!"));
      process.exit(1);
    }

    const tempPages: PageRecord[] = urls.map((url, i) => ({ page: i + 1, ...url, done: false, times: 0 }));
    const pages = filterPages(tempPages);
    const jsonPath = writeJSON(key, { title, size: pages.length, pages: pages });

    console.log("[OUT] ", jsonPath);
  } catch (err) {
    console.error(pc.red("Can't catalog index page!"));
    process.exit(1);
  }
})();
