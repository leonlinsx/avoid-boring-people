// scripts/automation/publish0x_runner.js
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

const COOKIES_FILE =
  process.env.PUBLISH0X_COOKIES_FILE ||
  path.resolve('./cookies/publish0x.json');

async function autopostToPublish0x(post) {
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();

  if (!fs.existsSync(COOKIES_FILE)) {
    throw new Error(
      `No Publish0x cookies found at ${COOKIES_FILE}. Run login first.`,
    );
  }
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto('https://www.publish0x.com/newpost', {
    waitUntil: 'domcontentloaded',
  });

  if (page.url().includes('/login')) {
    throw new Error('⚠️ Session expired. Please refresh cookies.');
  }

  // Fill Title
  await page.waitForSelector('input[name="postTitle"]');
  await page.fill('input[name="postTitle"]', post.title);

  // Switch into TinyMCE iframe for content
  const frame = await page.frameLocator('#postText_ifr');
  await frame.locator('body#tinymce').click();
  await frame.locator('body#tinymce').fill(post.content);

  // TODO: Add tags once we confirm selector for tags input

  // For now, log instead of publish
  console.log(`🚀 Drafted post: ${post.title} (not published yet)`);

  // Uncomment once you're ready to auto-submit:
  // await page.click("button[type='submit']");

  await browser.close();
}

async function main() {
  try {
    const post = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
    await autopostToPublish0x(post);
  } catch (err) {
    console.error('❌ Publish0x autopost failed:', err);
    process.exit(0);
  }
}

main();
