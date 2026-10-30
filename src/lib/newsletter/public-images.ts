import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import sharp from 'sharp';

const privateAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  privateAddresses.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const)
  privateAddresses.addSubnet(address, prefix, 'ipv6');

async function imageAddresses(host: string): Promise<string[]> {
  return (await lookup(host, { all: true })).map(({ address }) => address);
}

/** Extract only image sources emitted by our constrained renderer. */
export function newsletterImageUrls(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) =>
        match[1].replaceAll('&amp;', '&').replaceAll('&#x26;', '&'),
      ),
    ),
  ];
}

/** GET-only preflight, before any campaign claim or subscriber mutation. */
export async function assertPublicNewsletterImages(
  html: string,
  request: typeof fetch = fetch,
  resolveAddresses: (host: string) => Promise<string[]> = imageAddresses,
): Promise<number> {
  const urls = newsletterImageUrls(html);
  for (const value of urls) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error(
        'Production newsletter images must use public HTTPS URLs.',
      );
    try {
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(hostname)
        ? [hostname]
        : await resolveAddresses(hostname);
      if (
        !addresses.length ||
        addresses.some((address) =>
          privateAddresses.check(
            address,
            isIP(address) === 6 ? 'ipv6' : 'ipv4',
          ),
        )
      )
        throw new Error('Image host is not public.');
      const response = await request(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (
        !response.ok ||
        !response.headers
          .get('content-type')
          ?.toLowerCase()
          .startsWith('image/') ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error('Image URL did not return image content.');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 10 * 1024 * 1024)
            throw new Error('Public image exceeds 10 MiB.');
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = Buffer.concat(chunks);
      const metadata = await sharp(bytes).metadata();
      const contentType = response.headers
        .get('content-type')!
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.mediaType !== contentType
      )
        throw new Error('Invalid image bytes.');
      await sharp(bytes).stats();
    } catch {
      throw new Error(
        `Production image preflight failed: ${url.origin}${url.pathname}. No email was sent.`,
      );
    }
  }
  return urls.length;
}
