import { timingSafeEqual } from 'node:crypto';
import { put } from '@vercel/blob';

/**
 * Instagram carousel media upload bridge.
 *
 * Meta fetches carousel images itself, so the rendered JPEGs have to live at
 * public HTTPS URLs. GitHub Actions renders them but has no Vercel Blob
 * credential: the store is authenticated with Vercel OIDC inside this project.
 * This handler is the only write path, and it exists solely to store one
 * carousel slide per request under a path the caller may not choose freely.
 */

/** Meta documents an 8 MB ceiling for an Instagram image container. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** The only object paths this endpoint writes: the renderer's content-addressed scheme. */
export const BLOB_PATH_PATTERN = /^instagram\/[A-Za-z0-9_-]{1,96}\/[0-9a-f]{12}\/slide-\d{2}\.jpg$/;

/** Header carrying the destination object path. */
export const BLOB_PATH_HEADER = 'x-blob-path';

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;

export type BlobUploader = (
  pathname: string,
  body: Buffer,
  options: { access: 'public'; addRandomSuffix: boolean; allowOverwrite: boolean; contentType: string },
) => Promise<{ url?: string; pathname?: string }>;

let blobUploader: BlobUploader = put as unknown as BlobUploader;

/** Test seam: replace the Blob uploader with a recorder. */
export function setBlobUploader(implementation: BlobUploader): void {
  blobUploader = implementation;
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

function isAuthorized(header: string | null, secret: string): boolean {
  const match = header === null ? null : /^Bearer (.+)$/.exec(header.trim());
  if (match === null) return false;
  const provided = Buffer.from(match[1], 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Keep the shared secret out of anything we log, whatever produced the text. */
function redact(message: string, secret: string): string {
  return secret === '' ? message : message.split(secret).join('[redacted]');
}

/**
 * Store one rendered carousel slide and answer with its public HTTPS URL.
 *
 * Fails closed: a request without the shared bearer secret, without a JPEG
 * body, or with an object path outside the carousel scheme is rejected before
 * any Blob write happens.
 */
export async function handleInstagramMediaUpload(
  request: Request,
  upload: BlobUploader = blobUploader,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405, { allow: 'POST' });

  // The endpoint is unusable rather than open when the shared secret is absent.
  const secret = (process.env.INSTAGRAM_MEDIA_UPLOAD_SECRET ?? '').trim();
  if (secret === '') {
    console.error('Instagram media upload rejected: INSTAGRAM_MEDIA_UPLOAD_SECRET is not configured.');
    return jsonResponse({ error: 'upload endpoint is not configured' }, 503);
  }
  if (!isAuthorized(request.headers.get('authorization'), secret)) {
    // Never echo the presented credential, and never log the expected one.
    console.error('Instagram media upload rejected: unauthorized request.');
    return jsonResponse({ error: 'unauthorized' }, 401, { 'www-authenticate': 'Bearer' });
  }

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'image/jpeg') return jsonResponse({ error: 'expected an image/jpeg body' }, 415);

  const pathname = (request.headers.get(BLOB_PATH_HEADER) ?? '').trim();
  if (!BLOB_PATH_PATTERN.test(pathname)) {
    console.error('Instagram media upload rejected: object path is not a carousel slide path.');
    return jsonResponse({ error: 'invalid object path' }, 400);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: 'payload too large' }, 413);
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength === 0) return jsonResponse({ error: 'empty body' }, 400);
  // The declared length is a caller claim; the bytes that arrived decide.
  if (body.byteLength > MAX_UPLOAD_BYTES) return jsonResponse({ error: 'payload too large' }, 413);
  if (!JPEG_MAGIC.every((byte, offset) => body[offset] === byte)) {
    return jsonResponse({ error: 'body is not a JPEG' }, 415);
  }

  try {
    // Public access is required: Meta fetches these objects anonymously. The
    // pathname is already unique and content-addressed, so a random suffix
    // would only break retry idempotency, and overwriting is safe precisely
    // because the same path always holds the same bytes.
    const result = await upload(pathname, body, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/jpeg',
    });
    const url = (result?.url ?? '').trim();
    const returnedPath = (result?.pathname ?? '').trim();
    if (url === '' || !url.startsWith('https://')) {
      console.error('Instagram media upload failed: the store did not return an HTTPS URL.');
      return jsonResponse({ error: 'the store did not return an HTTPS URL' }, 502);
    }
    if (returnedPath !== '' && returnedPath !== pathname) {
      console.error('Instagram media upload failed: the store stored a different pathname.');
      return jsonResponse({ error: 'the store stored a different pathname' }, 502);
    }
    console.info('Instagram carousel slide stored.', { bytes: body.byteLength });
    return jsonResponse({ url, pathname, bytes: body.byteLength }, 200);
  } catch (error) {
    // Keep the store's own error server-side; the caller only learns that it failed.
    const detail = error instanceof Error ? error.message : 'unknown error';
    console.error('Instagram media upload failed:', redact(detail, secret));
    return jsonResponse({ error: 'upload failed' }, 502);
  }
}
