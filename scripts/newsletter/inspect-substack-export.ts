import { readFile } from 'node:fs/promises';
import {
  parseImportArguments,
  assertCancellationEvidence,
  planSubstackImport,
} from '../../src/lib/newsletter/importer.ts';

try {
  const { inputPath, evidencePath, expectedEvidenceFingerprint } =
    parseImportArguments(process.argv.slice(2), false);
  const plan = planSubstackImport(
    await readFile(inputPath, 'utf8'),
    await readFile(evidencePath, 'utf8'),
  );
  assertCancellationEvidence(plan, expectedEvidenceFingerprint);
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        ...plan.summary,
        rosterFingerprint: plan.rosterFingerprint,
        fileFingerprint: plan.fileFingerprint,
        evidenceFileFingerprint: plan.evidenceFileFingerprint,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    'Export inspection refused: provide a private CSV path, retained cancellation evidence and its approved fingerprint, with supported columns and well-formed CSV.',
  );
  process.exitCode = 1;
}
