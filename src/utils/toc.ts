export interface Heading {
  level: number;
  id: string;
  text: string;
}

/**
 * Extracts h2 and h3 headings from rendered HTML content.
 * Returns an array of { level, id, text } objects.
 */
export function extractHeadings(html: string): Heading[] {
  const regex = /<h([2-3])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const headings: Heading[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const attributes = match[2];
    const idMatch = attributes.match(
      /\bid\s*=\s*("([^"]+)"|'([^']+)'|([^\s'">]+))/i,
    );

    if (!idMatch) continue;

    const id = idMatch[2] ?? idMatch[3] ?? idMatch[4] ?? '';

    if (!id) continue;

    headings.push({
      level: Number(match[1]),
      id,
      text: stripTags(match[3]),
    });
  }

  return headings;
}

/**
 * Helper to strip any nested HTML tags (like <em>, <code>) from heading text.
 */
function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}
