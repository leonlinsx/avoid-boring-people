export interface CollectionEntry<CollectionName extends string = string> {
  id: string;
  slug?: string;
  body: string;
  collection: CollectionName;
  data: Record<string, any>;
}

export async function getCollection<CollectionName extends string = string>(
  _collection: CollectionName,
): Promise<CollectionEntry<CollectionName>[]> {
  throw new Error(
    'getCollection is not implemented. Use setGetCollectionImplementation() to supply a stub in tests.',
  );
}
