import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';
import { mapSubstackRow } from '../../src/lib/newsletter/domain.ts';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('Usage: npm run newsletter:import:dry-run -- <substack-export.csv>');
}

const rows = parse(await readFile(inputPath, 'utf8'), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
}) as Record<string, string>[];

const mapped = rows.map(mapSubstackRow).filter((row) => row !== null);
const active = mapped.filter((row) => row.status === 'active').length;
const suppressed = mapped.length - active;
const uniqueEmails = new Set(mapped.map((row) => row.email)).size;

console.log(JSON.stringify({
  mode: 'dry-run',
  sourceRows: rows.length,
  excludedRows: rows.length - mapped.length,
  active,
  suppressed,
  uniqueEmails,
  duplicateEmails: mapped.length - uniqueEmails,
}, null, 2));
