import { parseFrontmatter } from '@astrojs/markdown-remark';

export function isPublishedPost(post: { data: { draft?: boolean } }): boolean {
  return post.data.draft !== true;
}

/** Use Astro's YAML parser, including comments, quoted keys and CRLF files. */
export function articleIsDraft(markdown: string): boolean {
  const value = parseFrontmatter(markdown).frontmatter.draft;
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error('Article draft must be true or false.');
  return value === true;
}

export function assertPublishedArticle(markdown: string): void {
  if (articleIsDraft(markdown))
    throw new Error('Draft articles cannot be used in production campaigns.');
}
