import puppeteer, { Browser, WaitForOptions } from "puppeteer";

export const gotoOptions: WaitForOptions = { waitUntil: "domcontentloaded" };

// protocolTimeout: 60000
export const launch = async (): Promise<Browser> => puppeteer.launch({ headless: true, protocolTimeout: 60000 });
