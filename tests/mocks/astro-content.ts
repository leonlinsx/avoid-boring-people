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
