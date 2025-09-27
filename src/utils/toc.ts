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
  const regex = /<h([2-3])\b[^>]*\sid=(['"])([^'"<>]+)\2[^>]*>(.*?)<\/h\1>/gis;
  const headings: Heading[] = [];
  let match;

  while ((match = regex.exec(html))) {
    headings.push({
      level: Number(match[1]),
      id: match[3],
      text: stripTags(match[4]),
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
