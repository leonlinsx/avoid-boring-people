import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const imageExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const contentRoot = fileURLToPath(new URL('../content/blog/', import.meta.url));

function isImage(path: string): boolean {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return imageExtensions.has(extension);
}

async function copyDirectory(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = resolve(source, entry.name);
    const destinationPath = resolve(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile() && isImage(entry.name)) {
      await mkdir(resolve(destinationPath, '..'), { recursive: true });
      await copyFile(sourcePath, destinationPath);
    }
  }
}

/**
 * Copies article images to stable public paths for the constrained email
 * renderer. Astro's normal image pipeline deliberately uses build hashes,
 * which are unsuitable for mail composed independently of a site deploy.
 */
export function newsletterAssets(): AstroIntegration {
  return {
    name: 'newsletter-assets',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const outputRoot = fileURLToPath(dir);
        await copyDirectory(contentRoot, resolve(outputRoot, 'newsletter-assets'));
      },
    },
  };
}

export function newsletterAssetPath(articleId: string, assetPath: string): string {
  const articleDirectory = resolve(contentRoot, articleId.replace(/\/(?:index)?\.mdx?$/i, ''));
  const asset = resolve(articleDirectory, assetPath);
  const sourceRoot = `${contentRoot.endsWith('/') ? contentRoot.slice(0, -1) : contentRoot}/`;
  if (!asset.startsWith(sourceRoot) || !isImage(asset)) {
    throw new Error(`Unsupported newsletter asset path: ${assetPath}`);
  }
  return `/newsletter-assets/${relative(contentRoot, asset).split('\\').join('/')}`;
}
