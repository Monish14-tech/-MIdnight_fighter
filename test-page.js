import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    page.on('response', response => {
        if (!response.ok()) {
            console.log(`PAGE ERR: ${response.status()} ${response.url()}`);
        }
    });

    await page.goto('http://localhost:3000');

    // Wait a bit for game init to run and crash
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
