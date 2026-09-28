// Shared helpers for the translation CLI (`translations:translate`) and the
// informational status command (`translations:status`). Azure Translator (F0)
// only; no paid services, runtime translation, or new dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFootnotes from 'remark-footnotes';
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
export const MAX_CHUNK_CHARS = 10_000;
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

  private clock: ThrottleClock;

  constructor(clock: ThrottleClock = realClock) {
    this.clock = clock;
  }

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
  rejectedCandidatePath?: string;
  articleSlug?: string;
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
  // Keep complete Markdown links and images together: Translator may move
  // optional link titles into destinations or rearrange the brackets.
  text = text.replace(/!?\[[^\]\n]*\]\((?:[^)(\n]|\([^)(\n]*\))*\)/g, stash);
  // Inline code spans.
  text = text.replace(/`[^`\n]+`/g, stash);
  // Angle-bracket spans (autolinks and inline HTML tags).
  text = text.replace(/<[^>\n]+>/g, stash);
  // Footnote references: translate the prose, keep the labels.
  text = text.replace(/\[\^[^\]]+\]/g, stash);
  // Reference-style link definitions keep their labels and destinations.
  text = text.replace(/^\s*\[[^\]]+\]:[^\n]+/gm, stash);
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

/** Split protected text without losing separators or cutting placeholders. */
export function splitIntoChunks(
  text: string,
  maxChars: number = MAX_CHUNK_CHARS,
): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const paragraph = window.lastIndexOf('\n\n');
    const line = window.lastIndexOf('\n');
    const space = window.lastIndexOf(' ');
    let cut =
      paragraph > 0
        ? paragraph + 2
        : line > 0
          ? line + 1
          : space > 0
            ? space + 1
            : maxChars;
    // Move a hard cut back to the start of a protected token.
    for (const match of rest.matchAll(/__I18NPH\d+__/g)) {
      const start = match.index;
      if (start >= cut) break;
      if (start + match[0].length > cut) {
        if (start === 0)
          throw new Error('Placeholder exceeds translation chunk limit');
        cut = start;
        break;
      }
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
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
  const chars = pending.reduce((sum, { text }) => sum + text.length, 0);
  if (chars > MAX_CHUNK_CHARS) {
    throw new Error(
      `Azure Translator request exceeds ${MAX_CHUNK_CHARS} source characters. No files were modified for this article.`,
    );
  }
  await throttle.pace(chars);
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
      const translation = payload[position]?.translations?.[0]?.text;
      if (typeof translation !== 'string') {
        throw new Error(
          `Azure Translator returned an unexpected response (${target}, item ${position}). No files were modified for this article.`,
        );
      }
      results[index] = translation;
    });
    return results;
  }
}

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  [key: string]: unknown;
};

type ProseSpan = {
  start: number;
  end: number;
  text: string;
  nodePath: string;
  translated?: string;
};

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // @ts-expect-error remark-footnotes bundles a different unified type tree.
  .use(remarkFootnotes, { inlineNotes: true });

function parseMarkdown(body: string): MarkdownNode {
  return markdownParser.parse(body) as unknown as MarkdownNode;
}

function sourceOffsets(node: MarkdownNode): { start: number; end: number } {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error(
      'Markdown node has no source offsets. No files were modified for this article.',
    );
  }
  return { start, end };
}

const literalNodes = new Set([
  'link',
  'linkReference',
  'image',
  'imageReference',
  'definition',
  'code',
  'inlineCode',
  'html',
  'footnoteReference',
  'break',
  'thematicBreak',
]);

function proseSpans(body: string, tree: MarkdownNode): ProseSpan[] {
  const spans: ProseSpan[] = [];
  const visit = (node: MarkdownNode, nodePath: string): void => {
    if (literalNodes.has(node.type) || node.type.startsWith('mdx')) return;
    if (node.type === 'text') {
      const { start, end } = sourceOffsets(node);
      const raw = body.slice(start, end);
      const leading = raw.match(/^\s*/u)?.[0].length ?? 0;
      const trailing = raw.match(/\s*$/u)?.[0].length ?? 0;
      const core = raw.slice(leading, raw.length - trailing);
      if (!core) return;
      // A text node is one Azure item unless its core exceeds the request cap.
      let offset = start + leading;
      for (const part of splitIntoChunks(core)) {
        const prefix = part.match(/^\s*/u)?.[0].length ?? 0;
        const suffix = part.match(/\s*$/u)?.[0].length ?? 0;
        const text = part.slice(prefix, part.length - suffix);
        if (text)
          spans.push({
            start: offset + prefix,
            end: offset + part.length - suffix,
            text,
            nodePath,
          });
        offset += part.length;
      }
      return;
    }
    node.children?.forEach((child, index) => {
      const identifier =
        child.type === 'footnoteDefinition' &&
        typeof child.identifier === 'string'
          ? `[^${child.identifier}]`
          : '';
      visit(
        child,
        `${nodePath}.children[${index}](${child.type}${identifier})`,
      );
    });
  };
  visit(tree, 'root');
  return spans;
}

/** The parsed Markdown shape and all original bytes outside prose text nodes. */
export function markdownStructureFingerprint(body: string): string {
  const tree = parseMarkdown(body);
  const textNodes: MarkdownNode[] = [];
  const shape = (node: MarkdownNode): unknown => {
    if (node.type === 'text') {
      textNodes.push(node);
      return { type: 'text' };
    }
    const fields: Record<string, unknown> = { type: node.type };
    for (const key of [
      'depth',
      'ordered',
      'start',
      'spread',
      'checked',
      'align',
      'url',
      'title',
      'alt',
      'identifier',
      'label',
      'referenceType',
      'lang',
      'meta',
    ]) {
      if (node[key] !== undefined) fields[key] = node[key];
    }
    if (literalNodes.has(node.type)) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      fields.raw =
        start === undefined || end === undefined
          ? null
          : body.slice(start, end);
    }
    if (node.children) fields.children = node.children.map(shape);
    return fields;
  };
  const structure = shape(tree);
  let syntax = body;
  for (const node of textNodes.reverse()) {
    const { start, end } = sourceOffsets(node);
    syntax =
      syntax.slice(0, start) +
      body.slice(start, end).replace(/[^\r\n]+/g, 'TEXT') +
      syntax.slice(end);
  }
  return JSON.stringify({ structure, syntax });
}

function describeStructureMismatch(source: string, candidate: string): string {
  const expected = JSON.parse(source) as Record<string, unknown>;
  const actual = JSON.parse(candidate) as Record<string, unknown>;
  const differences: Array<{
    path: string;
    category: string;
    before: unknown;
    after: unknown;
  }> = [];
  const categoryFor = (type: string): string => {
    if (type === 'heading') return 'headings';
    if (type === 'list' || type === 'listItem') return 'lists';
    if (type.includes('footnote')) return 'footnotes';
    if (type === 'link' || type === 'linkReference' || type === 'definition')
      return 'links';
    if (type === 'image' || type === 'imageReference') return 'images';
    if (type === 'code' || type === 'inlineCode') return 'code';
    if (type === 'html') return 'HTML';
    if (type.startsWith('table')) return 'tables';
    return 'layout/nodes';
  };
  const compare = (
    before: unknown,
    after: unknown,
    location: string,
    type = '',
  ): void => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    if (Array.isArray(before) && Array.isArray(after)) {
      if (before.length !== after.length)
        differences.push({
          path: `${location}.length`,
          category: categoryFor(type),
          before: before.length,
          after: after.length,
        });
      for (
        let index = 0;
        index < Math.min(before.length, after.length);
        index += 1
      ) {
        const item = before[index] as Record<string, unknown> | undefined;
        const itemType = typeof item?.type === 'string' ? item.type : type;
        compare(
          before[index],
          after[index],
          `${location}[${index}](${itemType})`,
          itemType,
        );
      }
      return;
    }
    if (
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const left = before as Record<string, unknown>;
      const right = after as Record<string, unknown>;
      const nodeType = typeof left.type === 'string' ? left.type : type;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)]))
        compare(left[key], right[key], `${location}.${key}`, nodeType);
      return;
    }
    differences.push({
      path: location,
      category: location.startsWith('syntax')
        ? 'layout/syntax'
        : location.endsWith('.type') && typeof after === 'string'
          ? categoryFor(after)
          : categoryFor(type),
      before,
      after,
    });
  };
  compare(expected.structure, actual.structure, 'structure');
  if (expected.syntax !== actual.syntax) {
    const left = expected.syntax as string;
    const right = actual.syntax as string;
    let offset = 0;
    while (
      offset < Math.min(left.length, right.length) &&
      left[offset] === right[offset]
    )
      offset += 1;
    differences.push({
      path: `syntax at offset ${offset}`,
      category: 'layout/syntax',
      before: left.slice(Math.max(0, offset - 30), offset + 50),
      after: right.slice(Math.max(0, offset - 30), offset + 50),
    });
  }
  const first = differences[0];
  const value = (input: unknown): string => {
    const serialized = JSON.stringify(input);
    return serialized && serialized.length > 160
      ? `${serialized.slice(0, 157)}...`
      : (serialized ?? 'undefined');
  };
  return `First mismatch: ${first.path}: source=${value(first.before)}, candidate=${value(first.after)}. Categories: ${[...new Set(differences.map((difference) => difference.category))].join(', ')}.`;
}

type ValidationResult =
  | { severity: 'pass' }
  | { severity: 'warning'; detail: string }
  | { severity: 'hard'; detail: string };

const blockNodes = new Set([
  'root',
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'footnoteDefinition',
  'table',
  'tableRow',
  'tableCell',
  'code',
  'html',
  'thematicBreak',
]);

function markdownHardShape(node: MarkdownNode, body: string): unknown {
  const shape: Record<string, unknown> = { type: node.type };
  for (const key of [
    'depth',
    'ordered',
    'start',
    'spread',
    'checked',
    'identifier',
    'align',
    'lang',
    'meta',
  ]) {
    if (node[key] !== undefined) shape[key] = node[key];
  }
  if (node.type === 'code' || node.type === 'html') {
    const { start, end } = sourceOffsets(node);
    shape.raw = body.slice(start, end);
  }
  if (node.children) {
    shape.children = node.children
      .filter((child) => blockNodes.has(child.type))
      .map((child) => markdownHardShape(child, body));
  }
  return shape;
}

function markdownInvariants(tree: MarkdownNode, body: string) {
  const links: string[] = [];
  const images: string[] = [];
  const footnotes: string[] = [];
  const code: string[] = [];
  const html: string[] = [];
  const definitions: string[] = [];
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'link' || node.type === 'linkReference')
      links.push(String(node.url ?? node.identifier ?? ''));
    if (node.type === 'image' || node.type === 'imageReference')
      images.push(String(node.url ?? node.identifier ?? ''));
    if (node.type === 'footnoteReference')
      footnotes.push(String(node.identifier ?? ''));
    if (node.type === 'inlineCode') code.push(String(node.value ?? ''));
    if (node.type === 'html') {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      html.push(
        start === undefined || end === undefined
          ? String(node.value ?? '')
          : body.slice(start, end),
      );
    }
    if (node.type === 'definition')
      definitions.push(
        `${String(node.identifier ?? '')}:${String(node.url ?? '')}`,
      );
    node.children?.forEach(visit);
  };
  visit(tree);
  return { links, images, footnotes, code, html, definitions };
}

function visibleText(node: MarkdownNode): string {
  if (node.type === 'text' || node.type === 'inlineCode')
    return String(node.value ?? '');
  return (node.children ?? []).map(visibleText).join('');
}

function missingProse(
  source: MarkdownNode,
  candidate: MarkdownNode,
  nodePath = 'root',
): string | undefined {
  if (['paragraph', 'heading', 'tableCell'].includes(source.type)) {
    const before = visibleText(source).trim();
    const after = visibleText(candidate).trim();
    if (
      before &&
      (!after || (before.length >= 80 && after.length < before.length / 10))
    )
      return `${nodePath}: source prose has ${before.length} characters, candidate has ${after.length}`;
  }
  const left = (source.children ?? []).filter((child) =>
    blockNodes.has(child.type),
  );
  const right = (candidate.children ?? []).filter((child) =>
    blockNodes.has(child.type),
  );
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const detail = missingProse(
      left[index]!,
      right[index]!,
      `${nodePath}.children[${index}](${left[index]!.type})`,
    );
    if (detail) return detail;
  }
  return undefined;
}

function containsInOrder(source: string[], candidate: string[]): boolean {
  let index = 0;
  for (const value of candidate) if (value === source[index]) index += 1;
  return index === source.length;
}

/** Block/content loss is fatal; inline parser differences are diagnostic only. */
export function validateMarkdownStructure(
  source: string,
  candidate: string,
): ValidationResult {
  const sourceTree = parseMarkdown(source);
  const candidateTree = parseMarkdown(candidate);
  if (
    JSON.stringify(markdownHardShape(sourceTree, source)) !==
    JSON.stringify(markdownHardShape(candidateTree, candidate))
  )
    return {
      severity: 'hard',
      detail: `block structure changed. ${describeStructureMismatch(
        markdownStructureFingerprint(source),
        markdownStructureFingerprint(candidate),
      )}`,
    };
  const proseLoss = missingProse(sourceTree, candidateTree);
  if (proseLoss)
    return {
      severity: 'hard',
      detail: `missing or truncated prose: ${proseLoss}`,
    };
  const expected = markdownInvariants(sourceTree, source);
  const actual = markdownInvariants(candidateTree, candidate);
  for (const key of [
    'images',
    'footnotes',
    'code',
    'html',
    'definitions',
  ] as const)
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
      return {
        severity: 'hard',
        detail: `${key} changed: source=${JSON.stringify(expected[key])}, candidate=${JSON.stringify(actual[key])}`,
      };
  if (!containsInOrder(expected.links, actual.links)) {
    const missing = expected.links.find((url) => !actual.links.includes(url));
    const changed = actual.links.find(
      (url) => missing && url.startsWith(missing),
    );
    return {
      severity: 'hard',
      detail: `existing link destination changed or missing: source=${JSON.stringify(missing ?? expected.links)}, candidate=${JSON.stringify(changed ?? actual.links)}`,
    };
  }
  const sourceFingerprint = markdownStructureFingerprint(source);
  const candidateFingerprint = markdownStructureFingerprint(candidate);
  if (sourceFingerprint !== candidateFingerprint)
    return {
      severity: 'warning',
      detail: describeStructureMismatch(
        sourceFingerprint,
        candidateFingerprint,
      ),
    };
  return { severity: 'pass' };
}

/** Keep Azure prose literal when placed back into Markdown source. */
function escapeMarkdownText(text: string): string {
  // GFM autolinks URL/email-like text even when Markdown punctuation is escaped or entity-encoded.
  // Insert U+2060 only where necessary to preserve the source text-node structure; it may survive
  // copy/paste but keeps rendered text and document structure unchanged.
  const withoutAutolinks = text
    .replace(/\bhttps?:\/\//gi, (url) => `${url[0]}\u2060${url.slice(1)}`)
    .replace(/\bwww\./gi, (url) => `${url[0]}\u2060${url.slice(1)}`)
    .replace(/([\w.+-])@(?=[\w.-]+\.[a-z]{2,})/gi, '$1@\u2060');
  // CommonMark allows backslash escapes for every ASCII punctuation character.
  return withoutAutolinks.replace(
    /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g,
    '\\$&',
  );
}

/** Translate prose spans while keeping the source Markdown bytes in place. */
export async function translateProtectedBody(
  body: string,
  target: string,
  credentials: TranslatorCredentials,
  fetchImpl: typeof fetch = fetch,
  options: TranslateRequestOptions = {},
): Promise<string> {
  const spans = proseSpans(body, parseMarkdown(body));
  let batch: ProseSpan[] = [];
  let chars = 0;
  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const translated = await translateTexts(
      batch.map((span) => span.text),
      target,
      credentials,
      fetchImpl,
      options,
    );
    batch.forEach((span, index) => {
      const result = translated[index];
      if (!result || !result.trim()) {
        const sourceExcerpt = JSON.stringify(
          span.text.length > 100 ? `${span.text.slice(0, 100)}…` : span.text,
        );
        console.warn(
          `translation_fallback locale=${target} article=${options.articleSlug ?? 'unknown'} source=${sourceExcerpt}`,
        );
        span.translated = span.text;
      } else {
        span.translated = escapeMarkdownText(result);
      }
    });
    batch = [];
    chars = 0;
  };
  for (const span of spans) {
    if (chars + span.text.length > MAX_CHUNK_CHARS) await flush();
    batch.push(span);
    chars += span.text.length;
  }
  await flush();
  let translatedBody = body;
  for (const span of spans.reverse()) {
    translatedBody =
      translatedBody.slice(0, span.start) +
      (span.translated ?? span.text) +
      translatedBody.slice(span.end);
  }
  const validation = validateMarkdownStructure(body, translatedBody);
  if (validation.severity === 'hard') {
    const rejectedPath =
      options.rejectedCandidatePath ??
      path.join('/tmp', `abp-i18n-rejected-${target}-article.md`);
    fs.writeFileSync(rejectedPath, translatedBody, 'utf-8');
    throw new Error(
      `Azure Translator changed Markdown structure: ${validation.detail}. Rejected candidate: ${rejectedPath}. No files were modified for this article.`,
    );
  }
  if (validation.severity === 'warning')
    console.warn(
      `translation_structure_warning locale=${target} article=${options.articleSlug ?? 'unknown'} ${validation.detail}`,
    );
  return translatedBody;
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
