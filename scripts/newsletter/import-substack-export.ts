import { readFile } from 'node:fs/promises';
import { neonDb } from '../../src/lib/neon.ts';
import {
  assertImportApproval,
  parseImportArguments,
  assertCancellationEvidence,
  planSubstackImport,
} from '../../src/lib/newsletter/importer.ts';
import { applySubstackImport } from '../../src/lib/newsletter/import-store.ts';

try {
  const { inputPath, evidencePath, expectedEvidenceFingerprint, approval } =
    parseImportArguments(process.argv.slice(2), true);
  if (process.env.NEWSLETTER_ENVIRONMENT !== 'production')
    throw new Error('Production environment required.');
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error('Unsubscribe secret required.');
  const plan = planSubstackImport(
    await readFile(inputPath, 'utf8'),
    await readFile(evidencePath, 'utf8'),
  );
  assertCancellationEvidence(plan, expectedEvidenceFingerprint);
  assertImportApproval(plan, approval!);
  const result = await applySubstackImport(
    neonDb('Newsletter'),
    plan,
    approval!,
    secret,
  );
  console.log(
    JSON.stringify(
      {
        mode: 'applied',
        ...plan.summary,
        rosterFingerprint: plan.rosterFingerprint,
        fileFingerprint: plan.fileFingerprint,
        evidenceFileFingerprint: plan.evidenceFileFingerprint,
        ...result,
      },
      null,
      2,
    ),
  );
} catch {
  // Neither CSV parse errors nor database errors may disclose subscriber data.
  console.error(
    'Import refused or transaction failed. No partial transaction is retained. Run the read-only preflight and verify all approval arguments; after an uncertain network result, reconcile before retrying the same approved file.',
  );
  process.exitCode = 1;
}
