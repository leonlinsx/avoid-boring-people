// Custom test runner. Suites live in tests/suites and run in a fixed order.

import { runSiteUtilityTests } from './suites/site-utils.ts';
import { runNewsletterTests } from './suites/newsletter.ts';
import { runSeoMetaTests } from './suites/seo.ts';
import { runContentTests } from './suites/content.ts';
import { runDiscussionTests } from './suites/comments.ts';
import { runContactTests } from './suites/contact.ts';

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception', error);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection', reason);
  process.exitCode = 1;
});

async function run() {
  try {
    await runSiteUtilityTests();
    await runNewsletterTests();
    await runSeoMetaTests();
    await runContentTests();
    await runDiscussionTests();
    await runContactTests();
    console.log('✅ All custom tests passed');
  } catch (error) {
    console.error('❌ Test failure', error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('❌ Unhandled failure', error);
  process.exitCode = 1;
});
