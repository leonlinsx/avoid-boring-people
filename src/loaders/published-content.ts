import { readFileSync } from 'node:fs';
import { glob, type Loader } from 'astro/loaders';
import { articleIsDraft } from '../utils/publication.ts';

/**
 * Keep drafts out of Astro's store as well as routes: the store emits imported
 * hero/body images even when no public page renders the entry. Use the normal
 * glob loader and schema validation; only intercept storage of private entries.
 */
export function publishedGlob(
  options: Parameters<typeof glob>[0],
  translated = false,
): Loader {
  const loader = glob(options);
  return {
    ...loader,
    name: translated ? 'published-translations' : 'published-blog',
    load(context) {
      const hidden = (id: string, data: Record<string, unknown>): boolean => {
        if (data.draft === true) return true;
        if (!translated) return false;
        const source = id
          .split('/')
          .slice(1)
          .join('/')
          .replace(/\.mdx?$/, '');
        for (const extension of ['.md', '.mdx']) {
          try {
            return articleIsDraft(
              readFileSync(
                new URL(
                  `src/content/blog/${source}${extension}`,
                  context.config.root,
                ),
                'utf8',
              ),
            );
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        }
        return true;
      };
      // Source state can change without the translation's own digest changing.
      // Prune cached translations too, before glob takes its unchanged-entry path.
      for (const [id, entry] of context.store.entries()) {
        if (hidden(id, entry.data)) context.store.delete(id);
      }
      return loader.load({
        ...context,
        store: {
          ...context.store,
          set(entry) {
            if (hidden(entry.id, entry.data)) {
              context.store.delete(entry.id);
              return false;
            }
            return context.store.set(entry);
          },
        },
      });
    },
  };
}
