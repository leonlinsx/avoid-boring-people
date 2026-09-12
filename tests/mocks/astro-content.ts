import { z, type ZodTypeAny } from 'zod';

// Re-export the content-collection helpers the real `astro:content` module
// provides so schema files (e.g. src/content/config.ts) can be imported and
// exercised directly in tests. The context type mirrors the shape Astro passes
// to a schema function closely enough to avoid implicit-any diagnostics.
export { z };

export interface MockSchemaContext {
  image: () => ZodTypeAny;
}

export interface MockCollectionConfig {
  type: string;
  schema?: (context: MockSchemaContext) => unknown;
}

export function defineCollection<T extends MockCollectionConfig>(config: T): T {
  return config;
}

export interface CollectionEntry<CollectionName extends string = string> {
  id: string;
  slug?: string;
  body: string;
  collection: CollectionName;
  data: Record<string, any>;
}

type GetCollectionHandler = <CollectionName extends string = string>(
  collection: CollectionName,
) => Promise<CollectionEntry<CollectionName>[]>;

let handler: GetCollectionHandler | null = null;

export function __setMockGetCollectionImplementation(
  replacement: GetCollectionHandler | null,
) {
  handler = replacement;
}

export async function getCollection<CollectionName extends string = string>(
  collection: CollectionName,
): Promise<CollectionEntry<CollectionName>[]> {
  if (!handler) {
    throw new Error(
      'getCollection is not implemented. Use __setMockGetCollectionImplementation() to supply a stub in tests.',
    );
  }

  return handler(collection);
}
