declare module 'astro:content' {
  export function __setMockGetCollectionImplementation(
    replacement: ((collection: string) => Promise<any[]>) | null,
  ): void;
}
