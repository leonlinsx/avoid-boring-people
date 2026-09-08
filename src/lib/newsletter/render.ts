import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { SITE_URL } from '../../consts.ts';
import { newsletterAssetPath } from '../../integrations/newsletter-assets.ts';

const contentRoot = fileURLToPath(new URL('../../content/blog/', import.meta.url));
export const GMAIL_CLIP_LIMIT_BYTES = 100 * 1024;

export type NewsletterRenderInput = {
  articleId: string;
  title: string;
  markdown: string;
  unsubscribeUrl: string;
  privacyUrl: string;
  postalAddress: string;
};

export type NewsletterRenderResult = {
  html: string;
  text: string;
  headers: Record<string, string>;
};

export class NewsletterRenderError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

function isPrivateHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1';
}

function absoluteUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value, SITE_URL);
  } catch {
    throw new NewsletterRenderError(`${label} must be a valid URL.`);
  }
  if (url.protocol !== 'https:' || isPrivateHostname(url.hostname)) {
    throw new NewsletterRenderError(`${label} must be a public HTTPS URL.`);
  }
  return url.toString();
}

function resolveLink(value: string): string {
  if (value.startsWith('/')) return new URL(value, SITE_URL).toString();
  if (value.startsWith('./') || value.startsWith('../')) {
    throw new NewsletterRenderError(`Relative article link is not supported: ${value}`);
  }
  if (value.startsWith('mailto:')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NewsletterRenderError(`Article link must be absolute or site-relative: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || isPrivateHostname(url.hostname)) {
    throw new NewsletterRenderError(`Article link must use a public HTTP(S) URL: ${value}`);
  }
  return url.toString();
}

function resolveImage(value: string, articleId: string): string {
  if (value.startsWith('./') || value.startsWith('../')) {
    const relativePath = newsletterAssetPath(articleId, value);
    const source = resolve(contentRoot, relativePath.replace('/newsletter-assets/', ''));
    if (!existsSync(source)) throw new NewsletterRenderError(`Newsletter image does not exist: ${value}`);
    return new URL(relativePath, SITE_URL).toString();
  }
  return absoluteUrl(value, 'Article image');
}

function assertSupportedMarkdown(markdown: string): void {
  if (/^\s*(import|export)\s/m.test(markdown) || /<\/?[A-Z][A-Za-z0-9]*/.test(markdown)) {
    throw new NewsletterRenderError('MDX imports, exports, and components are not supported in newsletter email.');
  }
  if (/<\/?(?!https?:\/\/|mailto:)[a-zA-Z][^>]*>/i.test(markdown)) {
    throw new NewsletterRenderError('Raw HTML is not supported in newsletter email; use supported Markdown instead.');
  }
}

function markdownBody(markdown: string): string {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

function plainText(markdown: string): string {
  const tree: any = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const blocks: string[] = [];
  const toText = (node: any): string => {
    if (typeof node.value === 'string') return node.value;
    if (node.type === 'image') return node.alt ?? '';
    return (node.children ?? []).map(toText).join(node.type === 'break' ? '\n' : '');
  };
  for (const node of tree.children ?? []) {
    const value = toText(node).trim();
    if (value) blocks.push(value);
  }
  return blocks.join('\n\n');
}

export function renderNewsletterEmail(input: NewsletterRenderInput): NewsletterRenderResult {
  const postalAddress = input.postalAddress.trim();
  if (!postalAddress) throw new NewsletterRenderError('A compliant postal address is required before rendering email.');
  const unsubscribeUrl = absoluteUrl(input.unsubscribeUrl, 'Unsubscribe URL');
  const privacyUrl = absoluteUrl(input.privacyUrl, 'Privacy policy URL');
  const markdown = markdownBody(input.markdown);
  assertSupportedMarkdown(markdown);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree: any) => {
      visit(tree, 'link', (node: any) => { node.url = resolveLink(node.url); });
      visit(tree, 'image', (node: any) => { node.url = resolveImage(node.url, input.articleId); });
    })
    .use(remarkRehype)
    .use(() => (tree: any) => {
      visit(tree, 'element', (node: any) => {
        const styleByTag: Record<string, string> = {
          a: 'color:#2563eb;text-decoration:underline',
          blockquote: 'margin:16px 0;padding-left:16px;border-left:3px solid #d1d5db;color:#4b5563',
          code: 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em',
          h2: 'font-size:22px;line-height:1.25;margin:32px 0 12px',
          h3: 'font-size:18px;line-height:1.3;margin:24px 0 10px',
          img: 'display:block;max-width:100%;height:auto;margin:20px auto',
          li: 'margin:6px 0',
          p: 'margin:16px 0',
          pre: 'overflow-x:auto;padding:12px;background:#f3f4f6',
          table: 'width:100%;border-collapse:collapse',
          td: 'padding:8px;border:1px solid #d1d5db',
          th: 'padding:8px;border:1px solid #d1d5db;text-align:left;background:#f3f4f6',
        };
        const style = styleByTag[node.tagName];
        if (style) node.properties = { ...(node.properties ?? {}), style };
      });
    })
    .use(rehypeStringify);
  const articleHtml = String(processor.processSync(markdown));
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;color:#111827;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:680px;margin:0 auto;padding:32px 20px"><h1 style="font-size:28px;line-height:1.2">${escapeHtml(input.title)}</h1><article>${articleHtml}</article><footer style="margin-top:40px;padding-top:20px;border-top:1px solid #d1d5db;font-size:13px;color:#4b5563"><p>You received this because you subscribed to Avoid Boring People by Leon Lin. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a> · <a href="${escapeHtml(privacyUrl)}">Privacy</a> · ${escapeHtml(postalAddress)}</p></footer></main></body></html>`;
  if (Buffer.byteLength(html, 'utf8') > GMAIL_CLIP_LIMIT_BYTES) {
    throw new NewsletterRenderError('Rendered email exceeds the 100 KB Gmail clipping threshold.');
  }
  const text = `${input.title}\n\n${plainText(markdown)}\n\nUnsubscribe: ${unsubscribeUrl}\nPrivacy policy: ${privacyUrl}\n${postalAddress}`;
  return {
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export function readNewsletterArticle(articleId: string): string {
  const source = resolve(contentRoot, articleId);
  if (!source.startsWith(contentRoot) || !/\/index\.md$/.test(source)) {
    throw new NewsletterRenderError('Newsletter article must be a blog index.md file.');
  }
  if (!existsSync(source)) throw new NewsletterRenderError(`Newsletter article does not exist: ${articleId}`);
  return readFileSync(source, 'utf8');
}
