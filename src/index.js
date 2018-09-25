const puppeteer = require("puppeteer");

const target = process.argv[2];

puppeteer.launch().then(async browser => {
  const page = await browser.newPage();
  await page.goto(target, { waitUntil: "networkidle2" });

  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll(".gdtm a");
    return [...links].map(link => link.href);
  });

  console.log(urls);
  browser.close();
});
