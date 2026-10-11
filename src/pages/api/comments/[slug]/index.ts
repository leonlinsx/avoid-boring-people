import type { APIRoute } from 'astro';
import { tryNeonDb } from '../../../../lib/neon.ts';
import {
  handleCreateComment,
  handleListComments,
} from '../../../../lib/comments/handlers.ts';

export const prerender = false;

export const GET: APIRoute = ({ request, params }) =>
  handleListComments(request, { slug: params.slug ?? '' }, { db: tryNeonDb() });

export const POST: APIRoute = ({ request, params }) =>
  handleCreateComment(
    request,
    { slug: params.slug ?? '' },
    { db: tryNeonDb() },
  );
