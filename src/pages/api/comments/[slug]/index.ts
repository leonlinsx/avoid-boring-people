import type { APIRoute } from 'astro';
import { tryCommentsDb } from '../../../../lib/comments/db.ts';
import {
  handleCreateComment,
  handleListComments,
} from '../../../../lib/comments/handlers.ts';

export const prerender = false;

export const GET: APIRoute = ({ request, params }) =>
  handleListComments(
    request,
    { slug: params.slug ?? '' },
    { db: tryCommentsDb() },
  );

export const POST: APIRoute = ({ request, params }) =>
  handleCreateComment(
    request,
    { slug: params.slug ?? '' },
    { db: tryCommentsDb() },
  );
