// scripts/link-report.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import process from 'node:process';
import { LinkChecker, LinkState } from 'linkinator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'internal';
const requestTimeout = 10000;
const processTimeout = 5 * 60 * 1000;
const linkcheckPort = 4321;
const distDir = resolve(__dirname, '../dist');
const siteDir = resolve(distDir, 'client');

if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

const config = JSON.parse(
  readFileSync(resolve(__dirname, '../.linkinatorrc.json'), 'utf-8'),
);
const skipPatterns = (config.skip ?? []).map((pattern) => new RegExp(pattern));
const checker = new LinkChecker();
const processTimer = setTimeout(() => {
  console.error('❌ Link check timed out.');
  process.exit(1);
}, processTimeout);

let results;
try {
  results = await checker.check({
    path: 'index.html',
    serverRoot: siteDir,
    port: linkcheckPort,
    recurse: config.recurse,
    timeout: requestTimeout,
    linksToSkip: async (link) => {
      if (skipPatterns.some((pattern) => pattern.test(link))) {
        return true;
      }

      return mode === 'internal' && new URL(link).hostname !== 'localhost';
    },
  });
} catch (error) {
  console.error(
    '❌ Link check failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
} finally {
  clearTimeout(processTimer);
}

if (results.links.length === 0) {
  console.error(
    '❌ Linkinator found no pages. Run "npm run build" before running this check.',
  );
  process.exit(1);
}

const broken = results.links.filter((link) => link.state === LinkState.BROKEN);

const html = `
  <html>
  <head>
    <title>Broken Link Report</title>
    <style>
      body { font-family: sans-serif; padding: 2rem; }
      h1 { color: #b00; }
      ul { line-height: 1.6; }
      li strong { color: #b00; }
    </style>
  </head>
  <body>
    <h1>Broken Links (${broken.length})</h1>
    ${
      broken.length === 0
        ? '<p>✅ No broken links found!</p>'
        : `<ul>${broken
            .map(
              (link) =>
                `<li><strong>${link.status}</strong> <a href="${link.url}" target="_blank">${link.url}</a> <br/><small>Found on: ${link.parent}</small></li>`,
            )
            .join('')}</ul>`
    }
  </body>
  </html>
`;

const reportPath = resolve(distDir, 'link-report.html');
writeFileSync(reportPath, html, 'utf-8');
console.log(`✅ Report written to ${reportPath} [mode: ${mode}]`);

const openCmd =
  process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

exec(`${openCmd} "${reportPath}"`);
process.exit(broken.length > 0 ? 1 : 0);
