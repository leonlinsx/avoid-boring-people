import { campaignStatus } from '../../src/lib/newsletter/campaign-status.ts';

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId || process.argv.length !== 3)
    throw new Error('Usage: npm run newsletter:status -- <campaign-id>');
  console.log(JSON.stringify(await campaignStatus(campaignId), null, 2));
}
main().catch(() => {
  console.error(
    'Campaign status unavailable. Check campaign ID and database access. No data was changed.',
  );
  process.exitCode = 1;
});
