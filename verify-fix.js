import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    console.log('Navigating to game...');
    await page.goto('http://localhost:3000');
    await new Promise(r => setTimeout(r, 2000));

    // 1. Capture Main Menu (check for overlaps)
    await page.screenshot({ path: 'verify_main_menu.png' });
    console.log('Captured main menu.');

    // 2. Open Rank Info
    console.log('Opening Rank Info...');
    await page.evaluate(() => {
        const badge = document.getElementById('player-rank-main');
        if (badge) badge.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'verify_rank_info.png' });
    console.log('Captured rank info screen.');

    // 3. Test Back Button from Ranks
    console.log('Testing back button from Ranks...');
    await page.evaluate(() => {
        const backBtn = document.getElementById('back-from-ranks-btn');
        if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'verify_return_to_main.png' });
    console.log('Captured return to main menu.');

    // 4. Open Leaderboard
    console.log('Opening Leaderboard...');
    await page.evaluate(() => {
        const lbBtn = document.getElementById('leaderboard-btn');
        if (lbBtn) lbBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000)); // Wait for scores to load
    await page.screenshot({ path: 'verify_leaderboard_badges.png' });
    console.log('Captured leaderboard with badges.');

    await browser.close();
    console.log('Verification complete.');
})();
