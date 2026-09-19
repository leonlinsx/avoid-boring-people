import type { APIRoute } from 'astro';
import { tryContactDb } from '../../lib/contact/db.ts';
import { handleContactNote } from '../../lib/contact/handlers.ts';

// On demand: a note is a write, and the pages that offer the form stay static.
export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleContactNote(request, { db: tryContactDb() });
