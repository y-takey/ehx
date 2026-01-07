import puppeteer, { Browser, WaitForOptions } from "puppeteer";

export const gotoOptions: WaitForOptions = { waitUntil: "domcontentloaded" };

export const launch = async (): Promise<Browser> => puppeteer.launch({ headless: true });
