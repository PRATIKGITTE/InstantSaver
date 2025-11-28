// puppeteer-dp-fetch.js
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const number = process.argv[2];
  if (!number) return console.error('Missing number');

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: puppeteer.executablePath(),
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu"
  ]
});

  const page = await browser.newPage();

  try {
    await page.goto(`https://wa.me/${number}`, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(3000);

    const dp = await page.evaluate(() => {
      const img = document.querySelector('img');
      return img?.src || null;
    });

    if (dp) {
      console.log(JSON.stringify({ imageUrl: dp }));
    } else {
      console.log(JSON.stringify({ error: 'DP not found or number invalid' }));
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  } finally {
    await browser.close();
  }
})();
