import { readFile } from 'node:fs/promises';
import {
  parseImportArguments,
  planSubstackImport,
} from '../../src/lib/newsletter/importer.ts';

try {
  const { inputPath } = parseImportArguments(process.argv.slice(2), false);
  const plan = planSubstackImport(await readFile(inputPath, 'utf8'));
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        ...plan.summary,
        rosterFingerprint: plan.rosterFingerprint,
        fileFingerprint: plan.fileFingerprint,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    'Export inspection refused: provide one private CSV path with supported columns and well-formed CSV.',
  );
  process.exitCode = 1;
}
