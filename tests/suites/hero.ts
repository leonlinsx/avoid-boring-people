import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { REPO_ROOT } from '../helpers/harness.ts';

const BLOG_DIR = path.join(REPO_ROOT, 'src/content/blog');
const HERO_TARGET_WIDTH = 1200;
const HERO_TARGET_HEIGHT = 630;
const HERO_ASPECT = HERO_TARGET_WIDTH / HERO_TARGET_HEIGHT; // ~1.9047

// Only enforce for articles published on/after this cutoff so legacy
// heroes remain grandfathered but future mistakes are caught.
const ENFORCE_CUTOFF = new Date('2026-10-30T00:00:00.000Z');

function parseFrontmatterHero(filePath: string): {
  heroImage?: string;
  pubDate?: Date;
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const frontmatter = match[1];
  const heroMatch = frontmatter.match(
    /^\s*heroImage:\s*['"]?([^'"\n]+)['"]?\s*$/m,
  );
  const dateMatch = frontmatter.match(/^\s*pubDate:\s*([^\n]+)\s*$/m);
  let pubDate: Date | undefined;
  if (dateMatch) {
    const raw = dateMatch[1].trim().replace(/^['"]|['"]$/g, '');
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) pubDate = parsed;
  }
  return {
    heroImage: heroMatch?.[1]?.trim(),
    pubDate,
  };
}

function resolveHeroPath(
  heroImage: string,
  entryDir: string,
): string | undefined {
  if (!heroImage) return undefined;
  if (/^https?:\/\//i.test(heroImage)) return undefined; // external, skip
  if (heroImage.startsWith('/')) {
    // Absolute public path - check public dir
    return path.join(REPO_ROOT, 'public', heroImage);
  }
  // Relative to the article directory (./a_6_hero.webp etc.)
  // entryDir is like src/content/blog/2026_10_31_anthropic_ipo
  return path.join(entryDir, heroImage.replace(/^\.\//, ''));
}

export async function testHeroImageDimensions() {
  const entries = fs.readdirSync(BLOG_DIR, { withFileTypes: true });
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryDir = path.join(BLOG_DIR, entry.name);
    const indexMd = path.join(entryDir, 'index.md');
    const indexMdx = path.join(entryDir, 'index.mdx');
    const filePath = fs.existsSync(indexMd)
      ? indexMd
      : fs.existsSync(indexMdx)
        ? indexMdx
        : undefined;
    if (!filePath) continue;

    const { heroImage, pubDate } = parseFrontmatterHero(filePath);
    if (!heroImage) continue;

    const heroPath = resolveHeroPath(heroImage, entryDir);
    if (!heroPath) continue;
    if (!fs.existsSync(heroPath)) {
      failures.push(
        `${entry.name}: heroImage "${heroImage}" does not exist at ${path.relative(REPO_ROOT, heroPath)}`,
      );
      continue;
    }

    // Skip non-image extensions (should not happen)
    if (!/\.(webp|png|jpg|jpeg|avif|gif)$/i.test(heroPath)) continue;

    let metadata: { width?: number; height?: number };
    try {
      metadata = await sharp(heroPath).metadata();
    } catch (error) {
      failures.push(
        `${entry.name}: unable to read hero image ${path.relative(REPO_ROOT, heroPath)} - ${(error as Error).message}`,
      );
      continue;
    }

    const { width, height } = metadata;
    if (!width || !height) {
      warnings.push(
        `${entry.name}: could not determine dimensions for ${path.relative(REPO_ROOT, heroPath)}`,
      );
      continue;
    }

    const isEnforced = pubDate && pubDate >= ENFORCE_CUTOFF;

    // For enforced articles (new), require exactly 1200x630
    if (isEnforced) {
      if (width !== HERO_TARGET_WIDTH || height !== HERO_TARGET_HEIGHT) {
        failures.push(
          `${entry.name}: heroImage "${heroImage}" is ${width}×${height}, expected exactly ${HERO_TARGET_WIDTH}×${HERO_TARGET_HEIGHT} for ${path.relative(REPO_ROOT, heroPath)} (pubDate ${pubDate.toISOString().slice(0, 10)}). Use white padding/letterboxing if needed to avoid cropping chart content.`,
        );
      }
      continue;
    }

    // For legacy articles, only warn if aspect is far from target (to surface future issues without breaking)
    const aspect = width / height;
    const deviation = Math.abs(aspect - HERO_ASPECT) / HERO_ASPECT;
    if (deviation > 0.5) {
      // Very far (e.g., square vs 1.91) - warn
      warnings.push(
        `${entry.name}: heroImage "${heroImage}" is ${width}×${height} (aspect ${aspect.toFixed(2)}) far from target ${HERO_TARGET_WIDTH}×${HERO_TARGET_HEIGHT} (1.91:1) at ${path.relative(REPO_ROOT, heroPath)}`,
      );
    }
  }

  if (warnings.length) {
    for (const warning of warnings) {
      console.warn(`hero_validation_warning: ${warning}`);
    }
  }

  if (failures.length) {
    assert.fail(
      `Hero image validation failed for ${failures.length} article(s):\n- ${failures.join('\n- ')}\n\nExpected hero images for articles on/after ${ENFORCE_CUTOFF.toISOString().slice(0, 10)} to be exactly ${HERO_TARGET_WIDTH}×${HERO_TARGET_HEIGHT} (1.91:1) to avoid cropping. Use white padding/letterboxing if needed.`,
    );
  }
}

// Lightweight aspect check for any hero (used by legacy warnings)
export function heroAspectRatio(width: number, height: number): number {
  return width / height;
}

export async function runHeroTests() {
  await testHeroImageDimensions();
}
