import {
  newsletterArticleUrl,
  newsletterPreheader,
  newsletterMetadata,
} from './presentation.ts';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit, SKIP } from 'unist-util-visit';
/* eslint-disable @typescript-eslint/no-explicit-any -- unist/mdast traversal nodes are structurally untyped; every rewrite is pinned by renderer behavior tests. */
import { SITE_URL } from '../../consts.ts';
import { newsletterAssetPath } from '../../integrations/newsletter-assets.ts';

const contentRoot = fileURLToPath(
  new URL('../../content/blog/', import.meta.url),
);
const publicRoot = fileURLToPath(new URL('../../../public/', import.meta.url));
export const GMAIL_CLIP_LIMIT_BYTES = 100 * 1024;

export type NewsletterRenderInput = {
  articleId: string;
  title: string;
  markdown: string;
  unsubscribeUrl: string;
  privacyUrl: string;
  /** Explicit sender identification; ordinary editorial CLI commands omit it. */
  postalAddress?: string;
  /** Description-based inbox snippet; disable explicitly when desired. */
  preheader?: boolean;
  /** Private preview/test only. Production keeps its public asset URL mapping. */
  resolveLocalImage?: (value: string) => string;
};

export type NewsletterRenderResult = {
  html: string;
  text: string;
  headers: Record<string, string>;
};

export class NewsletterRenderError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
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
    throw new NewsletterRenderError(
      `Relative article link is not supported: ${value}`,
    );
  }
  if (value.startsWith('mailto:')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NewsletterRenderError(
      `Article link must be absolute or site-relative: ${value}`,
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    isPrivateHostname(url.hostname)
  ) {
    throw new NewsletterRenderError(
      `Article link must use a public HTTP(S) URL: ${value}`,
    );
  }
  return url.toString();
}

function resolveImage(value: string, articleId: string): string {
  let url: URL;
  if (!value.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let assetPath: string;
    try {
      assetPath = newsletterAssetPath(articleId, value);
    } catch {
      throw new NewsletterRenderError(`Unsupported newsletter image: ${value}`);
    }
    url = new URL(assetPath, SITE_URL);
  } else {
    url = new URL(absoluteUrl(value, 'Article image'));
  }
  if (url.origin === new URL(SITE_URL).origin) {
    const isNewsletterAsset = url.pathname.startsWith('/newsletter-assets/');
    const root = isNewsletterAsset ? contentRoot : publicRoot;
    let path: string;
    try {
      path = decodeURIComponent(
        isNewsletterAsset
          ? url.pathname.slice('/newsletter-assets/'.length)
          : url.pathname.slice(1),
      );
    } catch {
      throw new NewsletterRenderError(`Invalid newsletter image: ${value}`);
    }
    const source = resolve(root, path);
    if (
      !source.startsWith(`${root.replace(/\/$/, '')}/`) ||
      !(
        isNewsletterAsset
          ? /\.(gif|jpe?g|png|webp)$/i
          : /\.(gif|jpe?g|png|webp|svg|avif)$/i
      ).test(source) ||
      !existsSync(source) ||
      !statSync(source).isFile()
    ) {
      throw new NewsletterRenderError(
        `Newsletter image does not exist: ${value}`,
      );
    }
  }
  return url.toString();
}

function assertSupportedMarkdown(markdown: string): void {
  if (/\{\{|\{%/.test(markdown)) {
    throw new NewsletterRenderError(
      'Unresolved template markup is not supported in newsletter email.',
    );
  }
  if (
    /^\s*(import|export)\s/m.test(markdown) ||
    /<\/?[A-Z][A-Za-z0-9]*/.test(markdown)
  ) {
    throw new NewsletterRenderError(
      'MDX imports, exports, and components are not supported in newsletter email.',
    );
  }
  if (/<\/?(?!https?:\/\/|mailto:)[a-zA-Z][^>]*>/i.test(markdown)) {
    throw new NewsletterRenderError(
      'Raw HTML is not supported in newsletter email; use supported Markdown instead.',
    );
  }
}

function markdownBody(markdown: string): string {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

function plainText(markdown: string): string {
  const tree: any = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const blocks: string[] = [];
  const noteNumbers = new Map<string, number>();
  const definitions = new Map<string, any>();
  visit(tree, 'footnoteReference', (node: any) => {
    if (!noteNumbers.has(node.identifier))
      noteNumbers.set(node.identifier, noteNumbers.size + 1);
  });
  visit(tree, 'footnoteDefinition', (node: any) => {
    definitions.set(node.identifier, node);
  });
  const toText = (node: any): string => {
    if (node.type === 'footnoteReference')
      return `[${noteNumbers.get(node.identifier)}]`;
    if (node.type === 'break') return '\n';
    if (typeof node.value === 'string') return node.value;
    if (node.type === 'list') {
      return node.children
        .map((item: any, index: number) => {
          const marker = node.ordered ? `${(node.start ?? 1) + index}. ` : '- ';
          const text = toText(item).trim();
          return marker + text.replace(/\n/g, `\n${' '.repeat(marker.length)}`);
        })
        .join('\n');
    }
    if (node.type === 'image' || node.type === 'imageReference')
      return node.alt ?? '';
    return (node.children ?? [])
      .map(toText)
      .join(node.type === 'listItem' ? '\n\n' : '');
  };
  for (const node of tree.children ?? []) {
    if (node.type === 'footnoteDefinition') continue;
    const value = toText(node).trim();
    if (value) blocks.push(value);
  }
  if (noteNumbers.size)
    blocks.push(
      'Notes:\n' +
        [...noteNumbers]
          .map(
            ([id, number]) =>
              `[${number}] ${toText(definitions.get(id)).trim()}`,
          )
          .join('\n'),
    );
  return blocks.join('\n\n');
}

export function renderNewsletterEmail(
  input: NewsletterRenderInput,
): NewsletterRenderResult {
  const unsubscribeUrl = absoluteUrl(input.unsubscribeUrl, 'Unsubscribe URL');
  const privacyUrl = absoluteUrl(input.privacyUrl, 'Privacy policy URL');
  const markdown = markdownBody(input.markdown);
  assertSupportedMarkdown(markdown);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree: any) => {
      // Malformed image syntax can parse as ordinary text and bypass the image visitor.
      visit(tree, 'text', (node: any) => {
        const source = markdown.slice(
          node.position.start.offset,
          node.position.end.offset,
        );
        if (/(?<!\\)!\[/.test(source)) {
          throw new NewsletterRenderError(
            'Malformed or unresolved Markdown image in newsletter email.',
          );
        }
      });
      const definitions = new Map<string, any>();
      visit(tree, 'definition', (node: any) => {
        if (!definitions.has(node.identifier))
          definitions.set(node.identifier, node);
      });
      visit(tree, 'imageReference', (node: any) => {
        const definition = definitions.get(node.identifier);
        if (!definition) {
          throw new NewsletterRenderError(
            'Unresolved newsletter image reference.',
          );
        }
        node.type = 'image';
        node.url = definition.url;
        node.title = definition.title;
      });
      visit(tree, 'link', (node: any) => {
        node.url = resolveLink(node.url);
      });
      visit(tree, 'image', (node: any) => {
        const local =
          !node.url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(node.url);
        node.url =
          local && input.resolveLocalImage
            ? input.resolveLocalImage(node.url)
            : resolveImage(node.url, input.articleId);
      });
    })
    .use(remarkRehype)
    .use(() => (tree: any) => {
      visit(
        tree,
        'element',
        (node: any, index: number | undefined, parent: any) => {
          const originalTag = node.tagName;
          if (originalTag === 'blockquote') {
            // Authored quotations are content, not quoted reply/thread history.
            node.tagName = 'div';
            node.properties = {
              ...(node.properties ?? {}),
              role: 'note',
              ariaLabel: 'Quoted passage',
            };
          }
          const styleByTag: Record<string, string> = {
            a: 'color:#0066cc;text-decoration:underline',
            blockquote:
              'margin:16px 0;padding-left:16px;border-left:3px solid #d1d5db;color:#4b5563',
            code: 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em',
            h2: 'font-size:22px;line-height:1.25;margin:32px 0 12px',
            h3: 'font-size:18px;line-height:1.3;margin:24px 0 10px',
            img: 'display:block;max-width:100%;height:auto;margin:0 auto',
            li: 'margin:6px 0',
            p: 'margin:16px 0',
            pre: 'overflow-x:auto;padding:12px;background:#f3f4f6',
            table: 'width:100%;border-collapse:collapse',
            td: 'padding:8px;border:1px solid #d1d5db',
            th: 'padding:8px;border:1px solid #d1d5db;text-align:left;background:#f3f4f6',
          };
          const style = styleByTag[originalTag];
          if (style) {
            // GFM puts column alignment on each th/td. Inline it for email
            // clients, where the generic header style otherwise wins.
            const align = node.properties?.align;
            const cellAlignment =
              (node.tagName === 'th' || node.tagName === 'td') &&
              (align === 'left' || align === 'center' || align === 'right')
                ? `;text-align:${align}`
                : '';
            node.properties = {
              ...(node.properties ?? {}),
              style:
                cellAlignment && node.tagName === 'th'
                  ? style.replace('text-align:left', cellAlignment.slice(1))
                  : `${style}${cellAlignment}`,
            };
          }
          if (originalTag === 'img' && parent && index !== undefined) {
            // A span is valid inside Markdown's image paragraph and caps charts
            // without upscaling small images or changing the website's originals.
            const source = node.properties?.src;
            const image =
              typeof source === 'string' &&
              source.startsWith('https://') &&
              parent.tagName !== 'a'
                ? {
                    type: 'element',
                    tagName: 'a',
                    properties: {
                      href: source,
                      title: 'Open image at original size',
                      ariaLabel: 'Open image at original size',
                      style: 'display:block',
                    },
                    children: [node],
                  }
                : node;
            parent.children[index] = {
              type: 'element',
              tagName: 'span',
              properties: {
                style: 'display:block;max-width:560px;margin:20px auto',
              },
              children: [image],
            };
            return SKIP;
          }
        },
      );
      // Keep generated IDs/backlinks untouched; only restyle the notes section.
      visit(tree, 'element', (section: any) => {
        if (section.properties?.dataFootnotes === undefined) return;
        section.properties.style =
          'margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.5;color:#666666';
        visit(section, 'element', (node: any) => {
          const styles: Record<string, string> = {
            h2: 'font-size:13px;font-weight:600;margin:0 0 12px;color:#666666',
            ol: 'margin:0;padding-left:20px',
            li: 'margin:0 0 8px;padding-left:2px',
            p: 'margin:0 0 4px',
          };
          if (styles[node.tagName])
            node.properties.style = styles[node.tagName];
        });
      });
    })
    .use(rehypeStringify);
  const articleHtml = String(processor.processSync(markdown));
  const articleUrl = newsletterArticleUrl(input.articleId, input.markdown);
  const preheader =
    input.preheader === false ? undefined : newsletterPreheader(input.markdown);
  const webLink = articleUrl
    ? `<a href="${escapeHtml(articleUrl)}" style="color:#0066cc;text-decoration:underline">Read online</a>`
    : '';
  const postal = input.postalAddress?.trim();
  const identity = 'Avoid Boring People by Leon Lin';
  const metadata = newsletterMetadata(input.markdown);
  const title = metadata.title || input.title;
  const date = metadata.pubDate?.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const byline = `Leon Lin${date ? ` · ${date}` : ''}`;
  const closing = 'What did I miss? Reply to this email.';
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;color:#222222;font-family:Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.7;overflow-wrap:anywhere">${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all" aria-hidden="true">${escapeHtml(preheader)}</div>` : ''}<main style="width:100%;max-width:640px;box-sizing:border-box;margin:0 auto;padding:32px 20px"><header style="padding-bottom:24px;margin-bottom:28px;border-bottom:1px solid #e5e7eb"><h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;margin:0 0 12px;color:#222222">${escapeHtml(title)}</h1>${metadata.description ? `<p data-subtitle style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-style:italic;line-height:1.5;color:#555555">${escapeHtml(metadata.description)}</p>` : ''}<p style="margin:0;font-size:13px;color:#6b6b6b">${byline}${webLink ? ` <span style="white-space:nowrap">· ${webLink}</span>` : ''}</p></header><article>${articleHtml}</article><section aria-label="Closing" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb"><p style="margin:0">${closing}${webLink ? ` <span style="white-space:nowrap">${webLink}</span>` : ''}</p></section><footer style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#666666"><p style="margin:0 0 8px"><strong>${identity}</strong></p>${postal ? `<p style="white-space:pre-line">${escapeHtml(postal)}</p>` : ''}<p style="margin:0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#0066cc;text-decoration:underline">Unsubscribe</a> · <a href="${escapeHtml(privacyUrl)}" style="color:#0066cc;text-decoration:underline">Privacy</a></p></footer></main></body></html>`;
  if (Buffer.byteLength(html, 'utf8') >= GMAIL_CLIP_LIMIT_BYTES) {
    throw new NewsletterRenderError(
      'Rendered email exceeds the 100 KB Gmail clipping threshold.',
    );
  }
  // The hidden inbox preheader is not repeated in the visible/text edition.
  const text = `${title}${metadata.description ? `\n${metadata.description}` : ''}\n${byline}${articleUrl ? ` Read online: ${articleUrl}` : ''}\n\n---\n\n${plainText(markdown)}\n\n---\n\n${closing}${articleUrl ? ` Read online: ${articleUrl}` : ''}\n\n---\n\n${identity}${postal ? `\n${postal}` : ''}\nUnsubscribe: ${unsubscribeUrl}\nPrivacy policy: ${privacyUrl}`;
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
    throw new NewsletterRenderError(
      'Newsletter article must be a blog index.md file.',
    );
  }
  if (!existsSync(source))
    throw new NewsletterRenderError(
      `Newsletter article does not exist: ${articleId}`,
    );
  if (!realpathSync(source).startsWith(realpathSync(contentRoot) + '/'))
    throw new NewsletterRenderError(
      'Newsletter article must remain within the blog directory.',
    );
  return readFileSync(source, 'utf8');
}
