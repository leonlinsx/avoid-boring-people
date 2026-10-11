// Comment, contact and signup endpoints share bounded JSON input handling.
// Check declared length first, then enforce the actual byte limit while reading
// because a client can omit or misstate Content-Length.

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

  // Bound actual bytes while streaming, including chunked requests and UTF-8.
  if (!request.body) return { ok: false, error: 'invalid_request' };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return { ok: false, error: 'too_large' };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false, error: 'invalid_request' };
  } finally {
    reader.releaseLock();
  }
  if (!text) return { ok: false, error: 'invalid_request' };

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
