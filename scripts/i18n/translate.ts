// One small translation command (Google Cloud Translation NMT only):
// `npm run translations:translate [-- --locale <code|prefix>] [-- --slug <slug>] [-- --force]`
//
// - Translates title, description, and Markdown body; URLs, code, images,
//   untranslatable frontmatter, and Markdown structure are preserved.
// - Writes static translated files (committed to Git) referencing canonical English assets.
// - Records a deterministic source hash; skips current translations unless
//   `--force` is passed; translates missing/stale files only.
// - Paces requests conservatively and retries
//   throttled (HTTP 429) requests with backoff before giving up.
// - Fails clearly without modifying files when local Google credentials are
//   unavailable or the API fails. Never runs in builds or CI.

import fs from 'node:fs';
import path from 'node:path';
import {
  I18N_DIR,
  TranslationThrottle,
  composeTranslatedFile,
  reuseSourceAssets,
  getFrontmatterValue,
  listSourceEntries,
  normalizeLocaleArg,
  readTargetHash,
  readTranslatorCredentials,
  splitFrontmatter,
  targetPath,
  translateProtectedBody,
  translateTexts,
  type SourceEntry,
} from './lib.ts';
import { LOCALES } from '../../src/utils/i18n.ts';

interface PlanItem {
  entry: SourceEntry;
  code: string;
  target: string;
}

function printUsage(): void {
  console.log(
    'Usage: npm run translations:translate -- [--locale <code|prefix>] [--slug <slug>] [--force]\n' +
      'Locales: ja, ko, es, pt-BR, fr, zh-Hans (prefixes ja, ko, es, pt, fr, zh).\n' +
      'Requires GOOGLE_CLOUD_PROJECT and local Application Default Credentials.',
  );
}

function parseArgs(argv: string[]): {
  locales: string[];
  slug?: string;
  force: boolean;
} {
  const locales: string[] = [];
  let slug: string | undefined;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--force') {
      force = true;
    } else if (arg === '--locale' && argv[i + 1]) {
      locales.push(normalizeLocaleArg(argv[(i += 1)] ?? ''));
    } else if (arg.startsWith('--locale=')) {
      locales.push(normalizeLocaleArg(arg.slice('--locale='.length)));
    } else if (arg === '--slug' && argv[i + 1]) {
      slug = argv[(i += 1)];
    } else if (arg.startsWith('--slug=')) {
      slug = arg.slice('--slug='.length);
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }
  return { locales, slug, force };
}

async function main(): Promise<void> {
  const { locales, slug, force } = parseArgs(process.argv.slice(2));
  const wanted = new Set(
    locales.length > 0 ? locales : LOCALES.map((locale) => locale.code),
  );
  for (const code of wanted) {
    if (!LOCALES.some((locale) => locale.code === code)) {
      console.error(
        `Unknown locale: ${code}. Expected one of ${LOCALES.map((locale) => locale.code).join(', ')}.`,
      );
      process.exit(2);
    }
  }

  // Read credentials before touching any file.
  let credentials;
  try {
    credentials = readTranslatorCredentials();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const entries = listSourceEntries().filter(
    (entry) => !slug || entry.slug === slug,
  );
  if (slug && entries.length === 0) {
    console.error(`No English article found for slug: ${slug}`);
    process.exit(2);
  }

  const plan: PlanItem[] = [];
  for (const entry of entries) {
    for (const code of wanted) {
      const target = targetPath(entry.entry, code);
      if (!force && readTargetHash(target) === entry.hash) continue;
      plan.push({ entry, code, target });
    }
  }

  if (plan.length === 0) {
    console.log('All translations are current. Nothing to do.');
    return;
  }

  // One throttle for the whole run so every request shares a single
  // rolling per-minute window.
  const throttle = new TranslationThrottle();

  // Probe the API before writing anything: bad credentials or quota must fail
  // here, not halfway through the corpus.
  const first = plan[0];
  if (!first) return;
  const probeTarget =
    LOCALES.find((locale) => locale.code === first.code)?.translatorTarget ??
    first.code;
  try {
    await translateTexts(
      ['Translation check'],
      probeTarget,
      credentials,
      fetch,
      {
        throttle,
      },
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  let done = 0;
  for (const item of plan) {
    const locale = LOCALES.find((l) => l.code === item.code);
    if (!locale) continue;
    const { frontmatter, body } = splitFrontmatter(item.entry.content);
    const title = getFrontmatterValue(frontmatter, 'title');
    if (!title) {
      console.error(
        `translation_failed entry=${item.entry.entry} reason=missing-title`,
      );
      process.exit(1);
    }
    const description = getFrontmatterValue(frontmatter, 'description');
    try {
      const [translatedTitle, translatedDescription, translatedBody] =
        await Promise.all([
          translateTexts([title], locale.translatorTarget, credentials, fetch, {
            throttle,
          }).then((texts) => texts[0] ?? title),
          description === undefined
            ? Promise.resolve(undefined)
            : translateTexts(
                [description],
                locale.translatorTarget,
                credentials,
                fetch,
                { throttle },
              ).then((texts) => texts[0] ?? description),
          translateProtectedBody(
            body,
            locale.translatorTarget,
            credentials,
            fetch,
            {
              throttle,
              articleSlug: item.entry.slug,
              rejectedCandidatePath: path.join(
                '/tmp',
                `abp-i18n-rejected-${locale.code}-${item.entry.slug}.md`,
              ),
            },
          ),
        ]);
      // The whole article translated successfully: only now write the file.
      const output = composeTranslatedFile({
        sourceFrontmatter: frontmatter,
        translatedTitle,
        translatedDescription,
        localeCode: locale.code,
        sourceSlug: item.entry.slug,
        sourceHash: item.entry.hash,
        translatedBody,
      });
      fs.mkdirSync(path.dirname(item.target), { recursive: true });
      fs.writeFileSync(
        item.target,
        reuseSourceAssets(output, item.entry.sourcePath, item.target),
        'utf-8',
      );
      done += 1;
      console.log(`translated ${item.code} ${item.entry.slug}`);
    } catch (error) {
      console.error((error as Error).message);
      console.error(
        `translation_failed entry=${item.entry.entry} locale=${item.code}`,
      );
      process.exit(1);
    }
  }

  console.log(
    `Done: ${done} file(s) written under ${path.relative(process.cwd(), I18N_DIR)}. Review and commit them.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
