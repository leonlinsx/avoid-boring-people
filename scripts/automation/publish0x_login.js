// scripts/automation/publish0x_login.js
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const COOKIES_FILE =
  process.env.PUBLISH0X_COOKIES_FILE ||
  path.resolve('./cookies/publish0x.json');

async function main() {
  const browser = await firefox.launch({ headless: false }); // real Firefox
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('👉 Opening Publish0x login page (Firefox)...');
  await page.goto('https://publish0x.com/login', {
    waitUntil: 'domcontentloaded',
  });

  console.log('⚡ Please log in manually in the Firefox window...');
  console.log(
    '   (You can close the window after logging in and waiting a moment)',
  );

  // Instead of a fixed timeout, wait for manual confirmation
  await new Promise((resolve) => {
    console.log("⏸ Press Enter here once you've logged in...");
    process.stdin.once('data', resolve);
  });

  // Save cookies after login
  const cookies = await context.cookies();
  const dir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));

  console.log(`✅ Cookies saved to ${COOKIES_FILE}`);
  await browser.close();
}

main().catch((err) => {
  console.error('❌ Error in login script:', err);
  process.exit(1);
});
