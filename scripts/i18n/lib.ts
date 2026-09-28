// Shared helpers for the translation CLI (`translations:translate`) and the
// informational status command (`translations:status`). Azure Translator (F0)
// only; no paid services, runtime translation, or new dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCleanSlug } from '../../src/utils/slug-helpers.ts';
import {
  LOCALES,
  computeSourceHash,
  localeByCode,
  localeByPrefix,
} from '../../src/utils/i18n.ts';

export { computeSourceHash, LOCALES };

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const BLOG_DIR = path.join(REPO_ROOT, 'src/content/blog');
export const I18N_DIR = path.join(REPO_ROOT, 'src/content/i18n');

const TRANSLATOR_API_VERSION = '3.0';
const MAX_CHUNK_CHARS = 4000;
const TRANSLATOR_WINDOW_MS = 60_000;

/** Conservative share of the F0 ~2M chars/hour rate, consumed evenly. */
export const TRANSLATOR_MAX_CHARS_PER_MINUTE = 25_000;
/** Small bounded number of retries on HTTP 429 before giving up. */
export const TRANSLATOR_MAX_RETRIES = 5;
const TRANSLATOR_RETRY_BASE_DELAY_MS = 2_000;
const TRANSLATOR_RETRY_MAX_DELAY_MS = 60_000;

export interface ThrottleClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: ThrottleClock = {
  now: () => Date.now(),
  sleep: (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * Rolling-window pacer for submitted source characters. One instance is
 * shared across every request in a run so the F0 per-minute rate is consumed
 * evenly instead of arriving in bursts that draw HTTP 429s.
 */
export class TranslationThrottle {
  private submissions: Array<{ at: number; chars: number }> = [];

  constructor(private clock: ThrottleClock = realClock) {}

  /** Wait until `chars` fit inside the current window, then record them. */
  async pace(chars: number): Promise<void> {
    if (chars <= 0) return;
    for (;;) {
      const now = this.clock.now();
      this.submissions = this.submissions.filter(
        (submission) => now - submission.at < TRANSLATOR_WINDOW_MS,
      );
      const used = this.submissions.reduce((sum, s) => sum + s.chars, 0);
      if (used + chars <= TRANSLATOR_MAX_CHARS_PER_MINUTE || used === 0) {
        this.submissions.push({ at: now, chars });
        return;
      }
      const oldest = this.submissions.reduce((a, b) => (a.at <= b.at ? a : b));
      const wait = TRANSLATOR_WINDOW_MS - (now - oldest.at);
      if (wait <= 0) {
        // Defensive against clock weirdness: drop the stale entry and recheck.
        this.submissions = this.submissions.filter((s) => s !== oldest);
        continue;
      }
      await this.clock.sleep(wait);
    }
  }
}

/** Process default so every request shares one window unless told otherwise. */
const sharedThrottle = new TranslationThrottle();

export interface TranslateRequestOptions {
  throttle?: TranslationThrottle;
  sleep?: (ms: number) => Promise<void>;
}

/** Retry-After in seconds or an HTTP date; undefined when absent/unparseable. */
function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  return undefined;
}

export interface TranslatorCredentials {
  key: string;
  region: string;
  endpoint: string;
}

/** Fail clearly before any file is touched when credentials are missing. */
export function readTranslatorCredentials(
  env: NodeJS.ProcessEnv = process.env,
): TranslatorCredentials {
  const key = (env.AZURE_TRANSLATOR_KEY ?? '').trim();
  const region = (env.AZURE_TRANSLATOR_REGION ?? '').trim();
  if (!key || !region) {
    throw new Error(
      'Azure Translator credentials are unavailable: set AZURE_TRANSLATOR_KEY ' +
        'and AZURE_TRANSLATOR_REGION (the F0 free tier is enough). No files were modified.',
    );
  }
  const endpoint = (env.AZURE_TRANSLATOR_ENDPOINT ?? '')
    .trim()
    .replace(/\/+$/, '');
  return {
    key,
    region,
    endpoint: endpoint || 'https://api.cognitive.microsofttranslator.com',
  };
}

/** Normalize a `--locale` argument (BCP47 code or short URL prefix). */
export function normalizeLocaleArg(value: string): string {
  const trimmed = value.trim();
  return (
    localeByCode(trimmed)?.code ?? localeByPrefix(trimmed)?.code ?? trimmed
  );
}

export interface SourceEntry {
  /** Content directory name, e.g. `2021_04_03_ergodicity`. */
  entry: string;
  slug: string;
  sourcePath: string;
  content: string;
  hash: string;
}

/** Every English article directory holding an `index.md` (or `index.mdx`). */
export function listSourceEntries(blogDir: string = BLOG_DIR): SourceEntry[] {
  let dirs: string[];
  try {
    dirs = fs.readdirSync(blogDir);
  } catch {
    return [];
  }
  const entries: SourceEntry[] = [];
  for (const entry of [...dirs].sort()) {
    const mdPath = path.join(blogDir, entry, 'index.md');
    const mdxPath = path.join(blogDir, entry, 'index.mdx');
    const sourcePath = fs.existsSync(mdPath)
      ? mdPath
      : fs.existsSync(mdxPath)
        ? mdxPath
        : undefined;
    if (!sourcePath) continue;
    const content = fs.readFileSync(sourcePath, 'utf-8');
    const { frontmatter } = splitFrontmatter(content);
    entries.push({
      entry,
      slug: computeCleanSlug({
        id: `${entry}/index.md`,
        data: { slug: getFrontmatterValue(frontmatter, 'slug') },
      }),
      sourcePath,
      content,
      hash: computeSourceHash(content),
    });
  }
  return entries;
}

export function targetPath(
  entry: string,
  code: string,
  i18nDir: string = I18N_DIR,
): string {
  return path.join(i18nDir, code, entry, 'index.md');
}

/** The recorded `sourceHash:` of an existing translation, if any. */
export function readTargetHash(targetFile: string): string | undefined {
  let content: string;
  try {
    content = fs.readFileSync(targetFile, 'utf-8');
  } catch {
    return undefined;
  }
  return getFrontmatterValue(
    splitFrontmatter(content).frontmatter,
    'sourceHash',
  );
}

export function splitFrontmatter(markdown: string): {
  frontmatter: string;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: '', body: markdown };
  return {
    frontmatter: match[1] ?? '',
    body: markdown.slice(match[0].length),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    const inner = trimmed.slice(1, -1);
    return trimmed.startsWith("'")
      ? inner.replace(/''/g, "'")
      : inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
}

/** Single-line `key: value` lookup; the corpus keeps titles one line. */
export function getFrontmatterValue(
  frontmatter: string,
  key: string,
): string | undefined {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  const raw = match?.[1]?.trim();
  if (!raw || raw === '>' || raw === '|') return undefined;
  return unquote(raw);
}

const yamlQuote = (value: string): string => JSON.stringify(value);

export interface ProtectedText {
  text: string;
  slots: string[];
}

const PLACEHOLDER = (index: number): string => `__I18NPH${index}__`;

/**
 * Replace URLs, code, images targets, and other must-not-translate spans with
 * placeholders so the structure survives translation. `restore` puts them back.
 */
export function protectMarkdown(body: string): ProtectedText {
  const slots: string[] = [];
  const stash = (match: string): string => {
    slots.push(match);
    return PLACEHOLDER(slots.length - 1);
  };
  let text = body;
  // Fenced code blocks first so nothing inside them is touched.
  text = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, stash);
  // Inline code spans.
  text = text.replace(/`[^`\n]+`/g, stash);
  // Angle-bracket spans (autolinks and inline HTML tags).
  text = text.replace(/<[^>\n]+>/g, stash);
  // Footnote references: translate the prose, keep the labels.
  text = text.replace(/\[\^[^\]]+\]/g, stash);
  // Markdown link/image destinations: `[label](url)` keeps a translatable label.
  text = text.replace(/(\]\()([^)\s]+)(\))/g, (_all, open, url, close) => {
    return `${open}${stash(url)}${close}`;
  });
  // Reference-style link definitions: `[ref]: url`.
  text = text.replace(/^(\s*\[[^\]]+\]:\s*)(\S+)/gm, (_all, open, url) => {
    return `${open}${stash(url)}`;
  });
  // Bare URLs.
  text = text.replace(/https?:\/\/[^\s)<>"'`]+/g, stash);
  return { text, slots };
}

export function restoreProtectedText(protected_: ProtectedText): string {
  return protected_.text.replace(/__I18NPH(\d+)__/g, (_all, index) => {
    const slot = protected_.slots[Number(index)];
    return slot ?? _all;
  });
}

/** Split protected text into translator-sized chunks on blank lines. */
export function splitIntoChunks(
  text: string,
  maxChars: number = MAX_CHUNK_CHARS,
): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const boundary =
      window.lastIndexOf('\n\n') > 0
        ? window.lastIndexOf('\n\n')
        : window.lastIndexOf('\n') > 0
          ? window.lastIndexOf('\n')
          : window.lastIndexOf(' ');
    let cut = boundary > 0 ? boundary : maxChars;
    // Never cut inside a placeholder; extend past it instead.
    const dangling = window.slice(0, cut).match(/__I18NPH\d*$/);
    if (dangling) {
      const end = rest.indexOf('__', cut);
      if (end !== -1) cut = end + 2;
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function translateTexts(
  texts: string[],
  target: string,
  credentials: TranslatorCredentials,
  fetchImpl: typeof fetch = fetch,
  options: TranslateRequestOptions = {},
): Promise<string[]> {
  const results: string[] = new Array(texts.length).fill('');
  const pending: Array<{ index: number; text: string }> = [];
  texts.forEach((text, index) => {
    if (text.trim()) pending.push({ index, text });
  });
  if (pending.length === 0) return results;
  const throttle = options.throttle ?? sharedThrottle;
  const sleep = options.sleep ?? realClock.sleep;
  await throttle.pace(pending.reduce((sum, { text }) => sum + text.length, 0));
  const url =
    `${credentials.endpoint}/translate?api-version=${TRANSLATOR_API_VERSION}` +
    `&from=en&to=${encodeURIComponent(target)}&textType=plain`;
  const body = JSON.stringify(pending.map(({ text }) => ({ Text: text })));
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': credentials.key,
          'Ocp-Apim-Subscription-Region': credentials.region,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (error) {
      throw new Error(
        `Azure Translator request failed (${target}): ${(error as Error).message}. No files were modified for this article.`,
      );
    }
    if (response.status === 429 && attempt < TRANSLATOR_MAX_RETRIES) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get('retry-after'),
      );
      const backoffMs = Math.min(
        TRANSLATOR_RETRY_MAX_DELAY_MS,
        TRANSLATOR_RETRY_BASE_DELAY_MS * 2 ** attempt,
      );
      await sleep(retryAfterMs ?? backoffMs);
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      if (response.status === 429) {
        throw new Error(
          `Azure Translator request failed (${target}): HTTP 429${detail ? ` ${detail}` : ''}. ` +
            `The request was throttled ${TRANSLATOR_MAX_RETRIES} times; the F0 per-minute rate is likely exceeded ` +
            'rather than the monthly quota — wait a minute and rerun to resume (completed translations are kept). ' +
            'No files were modified for this article.',
        );
      }
      throw new Error(
        `Azure Translator request failed (${target}): HTTP ${response.status}${detail ? ` ${detail}` : ''}. ` +
          'The free F0 quota may be exhausted. No files were modified for this article.',
      );
    }
    const payload = (await response.json()) as Array<{
      translations?: Array<{ text?: string }>;
    }>;
    if (!Array.isArray(payload) || payload.length !== pending.length) {
      throw new Error(
        `Azure Translator returned an unexpected response (${target}). No files were modified for this article.`,
      );
    }
    pending.forEach(({ index }, position) => {
      results[index] =
        payload[position]?.translations?.[0]?.text ?? texts[index];
    });
    return results;
  }
}

export async function translateProtectedBody(
  body: string,
  target: string,
  credentials: TranslatorCredentials,
  fetchImpl: typeof fetch = fetch,
  options: TranslateRequestOptions = {},
): Promise<string> {
  const guarded = protectMarkdown(body);
  const chunks = splitIntoChunks(guarded.text);
  const translated = await translateTexts(
    chunks,
    target,
    credentials,
    fetchImpl,
    options,
  );
  return restoreProtectedText({
    text: translated.join(''),
    slots: guarded.slots,
  });
}

/**
 * Compose the translated file: every source frontmatter line is preserved
 * verbatim except `title`/`description` (translated) plus the recorded
 * `locale`, `sourceSlug`, and deterministic `sourceHash`.
 */
export function composeTranslatedFile(options: {
  sourceFrontmatter: string;
  translatedTitle: string;
  translatedDescription?: string;
  localeCode: string;
  sourceSlug: string;
  sourceHash: string;
  translatedBody: string;
}): string {
  const {
    sourceFrontmatter,
    translatedTitle,
    translatedDescription,
    localeCode,
    sourceSlug,
    sourceHash,
    translatedBody,
  } = options;
  const managed = new Set([
    'title',
    'description',
    'locale',
    'sourceSlug',
    'sourceHash',
  ]);
  const lines = sourceFrontmatter
    .split('\n')
    .filter((line) => {
      const key = line.split(':')[0]?.trim() ?? '';
      return !managed.has(key);
    })
    .filter(
      (line, index, all) => line.trim() !== '' || index !== all.length - 1,
    );
  const head = [
    `title: ${yamlQuote(translatedTitle)}`,
    ...(translatedDescription !== undefined
      ? [`description: ${yamlQuote(translatedDescription)}`]
      : []),
  ];
  const tail = [
    `locale: '${localeCode}'`,
    `sourceSlug: '${sourceSlug}'`,
    `sourceHash: '${sourceHash}'`,
  ];
  return `---\n${[...head, ...lines, ...tail].join('\n')}\n---\n\n${translatedBody.replace(/^\n+/, '')}`;
}

/** Copy colocated assets (images, …) so relative body/hero paths keep working. */
export function copyMissingAssets(sourceDir: string, targetDir: string): void {
  let files: string[];
  try {
    files = fs.readdirSync(sourceDir);
  } catch {
    return;
  }
  for (const file of files) {
    if (/^index\.mdx?$/i.test(file)) continue;
    const from = path.join(sourceDir, file);
    const to = path.join(targetDir, file);
    try {
      if (fs.statSync(from).isFile() && !fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    } catch {
      // A missing asset must never fail translation; the build surfaces it.
    }
  }
}
