const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto('http://localhost:3000/agents', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000);
  
  // Wait for front face
  await page.screenshot({ path: 'coin_front.png' });
  await page.waitForTimeout(1200); // Wait for half a spin
  await page.screenshot({ path: 'coin_back.png' });
  
  await browser.close();
})();
