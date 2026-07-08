import * as cheerio from "cheerio";
import pc from "picocolors";
import { fetchHtml } from "../lib/fetcher";
import { existsFile, writeJSON, getDataKey } from "../lib/file";
import { Data, Page } from "../lib/types";

const parseTargetPages = (targetPage: string, maxPage: number) => {
  const result: Record<number, true> = {};
  if (!targetPage) return result;

  targetPage.split(",").forEach(str => {
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

const filterPages = (allPages: Page[], targetPage: string) => {
  if (!targetPage) return allPages;

  const targetPages = parseTargetPages(targetPage, allPages.length);

  return allPages.filter(rec => targetPages[rec.page]);
};

export async function collectUrls(url: string, dataPath: string, targetPage: string): Promise<void> {
  if (await existsFile(dataPath)) {
    return;
  }

  const firstHtml = await fetchHtml(`${url}?nw=always`);
  const $ = cheerio.load(firstHtml);

  let title = $("#gj").text().trim();
  if (!title) title = $("title").text().trim();

  const pageLinks = [url];
  const pageNums = $(".gtb .ptt a")
    .map((_, el) => Number($(el).text()))
    .get()
    .filter(num => !Number.isNaN(num));
  const lastPage = Number(pageNums[pageNums.length - 1]);
  if (lastPage !== 1) {
    [...Array(lastPage - 1)].forEach((_, i) => pageLinks.push(`${url}?p=${i + 1}`));
  }

  const pageUrls = pageLinks.length ? [...new Set(pageLinks.map(p => new URL(p!, url).href))] : [url];

  const pages: Page[] = [];
  let pageIndex = 1;

  for (const pageUrl of pageUrls) {
    const html = await fetchHtml(pageUrl);
    const $$ = cheerio.load(html);

    const links = $$("#gdt a")
      .map((_, el) => $$(el).attr("href"))
      .get()
      .filter(Boolean);

    for (const link of links) {
      pages.push({
        page: pageIndex++,
        url: new URL(link!, pageUrl).href,
        done: false,
        times: 0,
      });
    }
  }

  const filteredPages = filterPages(pages, targetPage);

  const data: Data = {
    title,
    url,
    size: filteredPages.length,
    pages: filteredPages,
  };

  console.log(`${getDataKey(dataPath)} ${title}`);
  if (!pages.length) {
    console.log(pc.red(`can't load index page: ${dataPath}`));
  }

  await writeJSON(dataPath, data);
}
