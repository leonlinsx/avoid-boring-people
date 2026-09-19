// Both the comment and contact endpoints read a small JSON object from the
// browser, so the size cap and the honeypot test live here once. The declared
// `Content-Length` is checked before the body is read and the body itself after,
// because a client can lie about the first.

export type JsonBodyErrorCode = 'too_large' | 'invalid_request';

export type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: JsonBodyErrorCode };

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const declaredLength = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    return { ok: false, error: 'too_large' };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  if (!text || text.length > maxBytes)
    return { ok: false, error: text ? 'too_large' : 'invalid_request' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return { ok: false, error: 'invalid_request' };
  return { ok: true, value: parsed as Record<string, unknown> };
}

// A hidden field that only a script would fill. A filled one is answered exactly
// as a successful submission so the trap leaves nothing to detect.
export function isHoneypotFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
}
