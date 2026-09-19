import type { APIRoute } from 'astro';
import { tryNeonDb } from '../../../../lib/neon.ts';
import {
  handleDeleteComment,
  handleUpdateComment,
} from '../../../../lib/comments/handlers.ts';

export const prerender = false;

export const PATCH: APIRoute = ({ request, params }) =>
  handleUpdateComment(
    request,
    { slug: params.slug ?? '', id: params.id ?? '' },
    { db: tryNeonDb() },
  );

export const DELETE: APIRoute = ({ request, params }) =>
  handleDeleteComment(
    request,
    { slug: params.slug ?? '', id: params.id ?? '' },
    { db: tryNeonDb() },
  );
