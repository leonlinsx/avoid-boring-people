import { readFile } from 'node:fs/promises';
import { planSubstackImport } from '../../src/lib/newsletter/importer.ts';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('Usage: npm run newsletter:import:dry-run -- <substack-export.csv>');
}

const plan = planSubstackImport(await readFile(inputPath, 'utf8'));

console.log(JSON.stringify({
  mode: 'dry-run',
  ...plan.summary,
}, null, 2));
