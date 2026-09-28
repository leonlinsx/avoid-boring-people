// Informational translation status: `npm run translations:status`
// `[-- --locale <code|prefix>] [-- --slug <slug>]`.
// Shows missing/stale/current translations per locale. Always exits 0 and is
// intentionally NOT a CI check: translation is low priority and must never
// block publishing.

import {
  listSourceEntries,
  normalizeLocaleArg,
  readTargetHash,
  targetPath,
} from './lib.ts';
import { LOCALES } from '../../src/utils/i18n.ts';

function parseArgs(argv: string[]): { locales: string[]; slug?: string } {
  const locales: string[] = [];
  let slug: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--locale' && argv[i + 1]) {
      locales.push(normalizeLocaleArg(argv[(i += 1)] ?? ''));
    } else if (arg.startsWith('--locale=')) {
      locales.push(normalizeLocaleArg(arg.slice('--locale='.length)));
    } else if (arg === '--slug' && argv[i + 1]) {
      slug = argv[(i += 1)];
    } else if (arg.startsWith('--slug=')) {
      slug = arg.slice('--slug='.length);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return { locales, slug };
}

function main(): void {
  const { locales, slug } = parseArgs(process.argv.slice(2));
  const wanted =
    locales.length > 0 ? locales : LOCALES.map((locale) => locale.code);
  const entries = listSourceEntries().filter(
    (entry) => !slug || entry.slug === slug,
  );

  let missing = 0;
  let stale = 0;
  let current = 0;
  for (const locale of wanted) {
    const rows: string[] = [];
    for (const entry of entries) {
      const target = targetPath(entry.entry, locale);
      const recorded = readTargetHash(target);
      if (recorded === undefined) {
        missing += 1;
        rows.push(`  missing ${entry.slug}`);
      } else if (recorded !== entry.hash) {
        stale += 1;
        rows.push(`  stale   ${entry.slug}`);
      } else {
        current += 1;
      }
    }
    console.log(`${locale}: ${entries.length} articles`);
    for (const row of rows) console.log(row);
  }
  console.log(`Total: ${current} current, ${stale} stale, ${missing} missing.`);
}

main();
