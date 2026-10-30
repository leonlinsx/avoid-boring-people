import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Attachment } from '@aws-sdk/client-sesv2';
import sharp from 'sharp';
import { renderNewsletterEmail, type NewsletterRenderInput } from './render.ts';

const contentRoot = fileURLToPath(
  new URL('../../content/blog/', import.meta.url),
);
export const MAX_PRIVATE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRIVATE_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_PRIVATE_IMAGES = 20;
const formats: Record<string, { type: string; format: string }> = {
  '.png': { type: 'image/png', format: 'png' },
  '.jpg': { type: 'image/jpeg', format: 'jpeg' },
  '.jpeg': { type: 'image/jpeg', format: 'jpeg' },
  '.gif': { type: 'image/gif', format: 'gif' },
  '.webp': { type: 'image/webp', format: 'webp' },
};

export const TEST_UNSUBSCRIBE_URL =
  'https://leonlins.com/api/newsletter/unsubscribe?token=test-only-not-a-subscriber';

/** Same renderer; only relative image destinations change for private previews. */
export async function renderPrivateNewsletter(input: NewsletterRenderInput) {
  const article = realpathSync(resolve(contentRoot, input.articleId));
  if (
    !article.startsWith(realpathSync(contentRoot) + sep) ||
    !article.endsWith(`${sep}index.md`)
  )
    throw new Error('Private preview requires a blog index.md file.');
  const directory = dirname(article);
  const files = new Map<string, Attachment>();
  let total = 0;
  const rendered = renderNewsletterEmail({
    ...input,
    resolveLocalImage(value) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        throw new Error('Invalid local newsletter image path.');
      }
      if (
        /[?#\\]/.test(decoded) ||
        decoded.includes(String.fromCharCode(0)) ||
        decoded.startsWith('/')
      )
        throw new Error(`Unsupported local newsletter image path: ${value}`);
      const candidate = resolve(directory, decoded);
      if (!candidate.startsWith(directory + sep))
        throw new Error(
          'Local newsletter images must remain inside the article directory.',
        );
      let source: string;
      try {
        source = realpathSync(candidate);
      } catch {
        throw new Error(`Local newsletter image is missing: ${value}`);
      }
      if (!source.startsWith(directory + sep))
        throw new Error(
          'Local newsletter image symlinks must remain inside the article directory.',
        );
      const existing = files.get(source);
      if (existing) return `cid:${existing.ContentId}`;
      const format = formats[extname(source).toLowerCase()];
      if (!format)
        throw new Error(`Unsupported local newsletter image type: ${value}`);
      const stat = statSync(source);
      if (
        !stat.isFile() ||
        stat.size === 0 ||
        stat.size > MAX_PRIVATE_IMAGE_BYTES
      )
        throw new Error(
          'Local newsletter images must be files of 1 byte to 5 MiB each.',
        );
      total += stat.size;
      if (total > MAX_PRIVATE_TOTAL_BYTES || files.size >= MAX_PRIVATE_IMAGES)
        throw new Error(
          'Private newsletter images exceed 10 MiB total or 20 files.',
        );
      const bytes = readFileSync(source);
      if (bytes.length !== stat.size)
        throw new Error('Newsletter image changed while being read.');
      const contentId = `abp-${createHash('sha256').update(source).digest('hex')}@preview`;
      files.set(source, {
        RawContent: bytes,
        FileName: basename(source),
        ContentType: format.type,
        ContentDisposition: 'INLINE',
        ContentId: contentId,
        ContentTransferEncoding: 'BASE64',
      });
      return `cid:${contentId}`;
    },
  });
  // Validate the actual bytes, not just a filename or a content-type claim.
  for (const [source, attachment] of files) {
    try {
      const metadata = await sharp(attachment.RawContent).metadata();
      if (metadata.format !== formats[extname(source).toLowerCase()].format)
        throw new Error('format mismatch');
      await sharp(attachment.RawContent).stats();
    } catch {
      throw new Error(
        `Invalid local newsletter image content: ${basename(source)}`,
      );
    }
  }
  return { ...rendered, attachments: [...files.values()] };
}

export function embeddedPreviewHtml(
  rendered: Awaited<ReturnType<typeof renderPrivateNewsletter>>,
): string {
  let html = rendered.html;
  for (const image of rendered.attachments) {
    html = html.replaceAll(
      `cid:${image.ContentId}`,
      `data:${image.ContentType};base64,${Buffer.from(image.RawContent!).toString('base64')}`,
    );
  }
  return html;
}
