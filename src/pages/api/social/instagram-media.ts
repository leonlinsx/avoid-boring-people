import type { APIRoute } from 'astro';
import { handleInstagramMediaUpload } from '../../../lib/social/instagram-media.ts';

export const prerender = false;

/**
 * Stores one rendered Instagram carousel slide in the public Vercel Blob store
 * and returns its URL. GitHub Actions calls this because the Blob store is
 * authenticated with OIDC inside this project, not with a shared token.
 */
export const POST: APIRoute = ({ request }) =>
  handleInstagramMediaUpload(request);
