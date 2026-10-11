import type { APIRoute } from 'astro';
import {
  logProductionDatabaseIdentity,
  tryNeonDb,
} from '../../../../lib/neon.ts';
import {
  handleCreateComment,
  handleListComments,
} from '../../../../lib/comments/handlers.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  const response = await handleListComments(
    request,
    { slug: params.slug ?? '' },
    { db: tryNeonDb() },
  );
  logProductionDatabaseIdentity(response);
  return response;
};

export const POST: APIRoute = ({ request, params }) =>
  handleCreateComment(
    request,
    { slug: params.slug ?? '' },
    { db: tryNeonDb() },
  );
