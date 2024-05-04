import puppeteer, { Browser, WaitForOptions } from "puppeteer";

export const gotoOptions: WaitForOptions = { waitUntil: "domcontentloaded" };

export const launch = async (): Promise<Browser> =>
  // --headless=old : hide bounded icon on the dock
  puppeteer.launch({ headless: true, args: ["--headless=old"] });
