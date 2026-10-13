import { readFile } from 'node:fs/promises';
import { neonDb } from '../../src/lib/neon.ts';
import {
  assertImportApproval,
  parseImportArguments,
  planSubstackImport,
} from '../../src/lib/newsletter/importer.ts';
import { preflightSubstackImport } from '../../src/lib/newsletter/import-store.ts';

try {
  const { inputPath } = parseImportArguments(process.argv.slice(2), false);
  const plan = planSubstackImport(await readFile(inputPath, 'utf8'));
  const reconciliation = await preflightSubstackImport(
    neonDb('Newsletter'),
    plan,
  );
  let inputValid = true;
  try {
    assertImportApproval(plan, {
      ...plan.summary,
      rosterFingerprint: plan.rosterFingerprint,
      fileFingerprint: plan.fileFingerprint,
    });
  } catch {
    inputValid = false;
  }
  const ready = inputValid && reconciliation.unexpectedCollisions === 0;
  console.log(
    JSON.stringify(
      {
        mode: 'read-only-preflight',
        ...plan.summary,
        rosterFingerprint: plan.rosterFingerprint,
        fileFingerprint: plan.fileFingerprint,
        ...reconciliation,
        inputValid,
        ready,
        emailSent: false,
        databaseWrites: 0,
      },
      null,
      2,
    ),
  );
  if (!ready) process.exitCode = 1;
} catch {
  console.error(
    'Read-only import preflight failed. Check private input, database access and schema; no database writes or emails were attempted.',
  );
  process.exitCode = 1;
}
