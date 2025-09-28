export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'astro:content') {
    return {
      shortCircuit: true,
      url: new URL('./mocks/astro-content.ts', import.meta.url).href,
    };
  }

  return nextResolve(specifier, context);
}
