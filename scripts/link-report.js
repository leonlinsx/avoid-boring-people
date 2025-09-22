// scripts/link-report.js
import { writeFileSync } from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import process from 'node:process';

// Ensure dist directory exists
import { mkdirSync, existsSync } from 'fs';

// Detect project root
const __dirname = dirname(fileURLToPath(import.meta.url));

// Mode: "internal" (default) or "external"
const mode = process.argv[2] || 'internal';

// Per-request timeout (ms)
const requestTimeout = 10000;
// Hard stop for entire crawl (ms)
const processTimeout = 5 * 60 * 1000;

// Skip externals in internal mode
const skipFlag = mode === 'internal' ? "--skip 'http*://*'" : '';

// Ensure dist folder exists
const distDir = resolve(__dirname, '../dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

exec(
  `npx linkinator http://localhost:4321 --config .linkinatorrc.json ${skipFlag} --format=json --timeout=${requestTimeout}`,
  { timeout: processTimeout },
  (err, stdout) => {
    if (err) {
      console.error('❌ Link check failed or timed out:', err.message);
      process.exit(1);
    }

    let results;
    try {
      results = JSON.parse(stdout);
    } catch (parseErr) {
      console.error('❌ Failed to parse linkinator output:', parseErr.message);
      process.exit(1);
    }

    const broken = results.links.filter((l) => l.state === 'BROKEN');

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
                  (l) =>
                    `<li><strong>${l.status}</strong> <a href="${l.url}" target="_blank">${l.url}</a> <br/><small>Found on: ${l.parent}</small></li>`,
                )
                .join('')}</ul>`
        }
      </body>
      </html>
    `;

    const reportPath = resolve(distDir, 'link-report.html');
    writeFileSync(reportPath, html, 'utf-8');

    console.log(`✅ Report written to ${reportPath} [mode: ${mode}]`);

    // Auto-open in browser (macOS/Linux/Windows)
    const openCmd =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';

    exec(`${openCmd} "${reportPath}"`);

    // Exit code for CI/CD
    process.exit(broken.length > 0 ? 1 : 0);
  },
);
