export async function getImage(options: {
  src: string | { src: string };
  [key: string]: unknown;
}) {
  return {
    src: typeof options.src === 'string' ? options.src : options.src.src,
  };
}

export const Image = Symbol('Image');
