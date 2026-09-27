export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'astro:content') {
    return {
      shortCircuit: true,
      url: new URL('./mocks/astro-content.ts', import.meta.url).href,
    };
  }
  if (specifier === 'astro:assets') {
    return {
      shortCircuit: true,
      url: new URL('./mocks/astro-assets.ts', import.meta.url).href,
    };
  }

  return nextResolve(specifier, context);
}
