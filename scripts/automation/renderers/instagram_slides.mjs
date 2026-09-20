#!/usr/bin/env node
/**
 * Deterministic Instagram carousel slide renderer.
 *
 * Pipeline: slide copy -> explicit line wrapping -> one deterministic SVG
 * document per slide -> sharp (librsvg/pango) -> sRGB JPEG at 1080x1350.
 *
 * There is no browser anywhere in this path. sharp is an ordinary project
 * dependency, so this runs wherever `npm ci` has run, including CI and headless
 * containers, without downloading Chromium.
 *
 * Reads one job as JSON on stdin and writes a JSON manifest on stdout; all
 * diagnostics go to stderr so stdout stays machine-readable.
 *
 * Fonts: the site ships Atkinson Hyperlegible as WOFF, which sharp's bundled
 * fontconfig cannot index (only the system fontconfig can). The regular and
 * bold faces are converted to sfnt (TTF) in memory, written into an ignored
 * scratch directory, and registered through a generated fontconfig file that
 * this renderer points FONTCONFIG_FILE at *before* importing sharp. Text width
 * is measured with fontkit against those same faces, so wrapping and
 * rasterizing agree.
 *
 * The renderer is the last place that can notice copy that does not fit, so it
 * fails loudly (exit code 3, `content_overflow`) instead of writing a clipped
 * or partially invisible image.
 */
import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import { create as createFont } from 'fontkit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

const DEFAULTS = { width: 1080, height: 1350, quality: 92 };

/** Editorial palette. Deliberately tiny: no accent, no gradients, no imagery. */
const TOKENS = {
  background: '#F7F7F5',
  ink: '#111111',
  inkSoft: '#555555',
  rule: '#D9D9D4',
};

/** The only slide kinds this renderer knows about. */
const KINDS = ['cover', 'body', 'final'];

/**
 * Type scale. Each field carries a short ladder of candidate sizes; the largest
 * size whose wrapped text still fits the line limit wins. A ladder keeps
 * typography consistent for normal copy and degrades predictably (instead of
 * clipping) for copy that sits at the storyboard's character limits.
 */
const TYPE = {
  cover: {
    title: { sizes: [92, 84, 76, 68], lines: 4, weight: 700, lineHeight: 1.14 },
    body: { sizes: [46, 42, 38], lines: 5, weight: 400, lineHeight: 1.46 },
  },
  body: {
    title: { sizes: [76, 68, 62], lines: 4, weight: 700, lineHeight: 1.16 },
    body: { sizes: [42, 38, 34], lines: 5, weight: 400, lineHeight: 1.5 },
  },
  final: {
    title: { sizes: [80, 72, 66], lines: 4, weight: 700, lineHeight: 1.16 },
    body: { sizes: [44, 40, 36], lines: 4, weight: 700, lineHeight: 1.42 },
  },
};

const LAYOUT = {
  padding: { top: 80, right: 84, bottom: 64, left: 84 },
  headerRuleOffset: 62,
  ruleHeight: 2,
  contentGap: 30,
  titleGap: 44,
  bodyGap: 32,
  footerRuleOffset: 74,
  /** Understated micro-type: the kicker, the slide counter, and the footer. */
  kicker: { size: 25, weight: 700, letterSpacing: 3.4 },
  counter: { size: 25, weight: 400, letterSpacing: 0.6 },
  footer: { size: 26, weight: 400, letterSpacing: 0.6 },
  /** Bands that must stay free of ink; also the pixel guard's tolerance band. */
  safeInset: 40,
  inkTolerance: 26,
};

/** The family name inside the brand font, not the CSS alias the site uses. */
const FONT_FAMILY = 'Atkinson Hyperlegible';
const FONT_FACES = {
  regular: { weight: 400, file: 'atkinson-regular.woff' },
  bold: { weight: 700, file: 'atkinson-bold.woff' },
};
const FONT_SCRATCH = path.join(
  REPO_ROOT,
  '.tmp',
  'social',
  'instagram',
  '.fonts',
);
const FONTCONFIG_FILE = path.join(FONT_SCRATCH, 'fonts.conf');

class RendererFailure extends Error {}

class RendererUnavailable extends RendererFailure {}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// XML 1.0 forbids most control characters, and copy can carry them through from
// a summarizer; tab, newline, and carriage return are the allowed exceptions.
const FORBIDDEN_XML_CHARS = new Set(
  Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)).filter(
    (character) => !'\t\n\r'.includes(character),
  ),
);

function escapeXml(value) {
  return [...String(value ?? '')]
    .filter((character) => !FORBIDDEN_XML_CHARS.has(character))
    .join('')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// --- font materialisation ---------------------------------------------------

function tableChecksum(padded) {
  let sum = 0;
  for (let offset = 0; offset < padded.length; offset += 4) {
    sum = (sum + padded.readUInt32BE(offset)) >>> 0;
  }
  return sum;
}

/**
 * Rebuild an sfnt (TTF) from a WOFF 1.0 container.
 *
 * sharp's bundled fontconfig does not index WOFF, and the repo ships brand
 * fonts as WOFF because that is what the website needs, so the renderer
 * converts the container itself: inflate each table, re-emit a normal sfnt
 * directory, keep every table's bytes untouched. No external tool, no new
 * build step.
 */
function sfntFromWoff(buffer) {
  if (buffer.length < 44 || buffer.readUInt32BE(0) !== 0x774f4646) {
    throw new RendererFailure('brand font is not a WOFF file');
  }
  const flavor = buffer.readUInt32BE(4);
  const numTables = buffer.readUInt16BE(12);
  const tables = [];
  for (let index = 0; index < numTables; index += 1) {
    const base = 44 + index * 20;
    const tag = buffer.toString('latin1', base, base + 4);
    const offset = buffer.readUInt32BE(base + 4);
    const compressedLength = buffer.readUInt32BE(base + 8);
    const originalLength = buffer.readUInt32BE(base + 12);
    const body = buffer.subarray(offset, offset + compressedLength);
    const data =
      compressedLength < originalLength ? zlib.inflateSync(body) : body;
    if (data.length !== originalLength) {
      throw new RendererFailure(
        `brand font table ${tag} has an unexpected length`,
      );
    }
    tables.push({ tag, data });
  }
  tables.sort((left, right) =>
    left.tag < right.tag ? -1 : left.tag > right.tag ? 1 : 0,
  );

  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);

  let offset = header.length;
  const bodies = [];
  tables.forEach((table, index) => {
    const body = Buffer.alloc((table.data.length + 3) & ~3);
    table.data.copy(body);
    const entry = 12 + index * 16;
    header.write(table.tag, entry, 4, 'latin1');
    header.writeUInt32BE(tableChecksum(body), entry + 4);
    header.writeUInt32BE(offset, entry + 8);
    header.writeUInt32BE(table.data.length, entry + 12);
    bodies.push(body);
    offset += body.length;
  });
  return Buffer.concat([header, ...bodies]);
}

async function writeIfChanged(file, data) {
  if (existsSync(file)) {
    const current = await readFile(file);
    if (current.length === data.length && current.equals(data)) return;
  }
  const staging = `${file}.${process.pid}.tmp`;
  await writeFile(staging, data);
  await rename(staging, file);
}

/**
 * Convert the brand WOFF faces to TTF and register them with fontconfig.
 *
 * Must run before sharp is imported: fontconfig reads FONTCONFIG_FILE when it
 * initialises inside sharp's bundled libvips, and imports are hoisted.
 */
async function prepareFonts() {
  await mkdir(FONT_SCRATCH, { recursive: true });
  const fonts = {};
  for (const [name, face] of Object.entries(FONT_FACES)) {
    const source = path.join(REPO_ROOT, 'public', 'fonts', face.file);
    if (!existsSync(source)) {
      throw new RendererFailure(`brand font is missing: ${source}`);
    }
    const target = path.join(
      FONT_SCRATCH,
      face.file.replace(/\.woff$/, '.ttf'),
    );
    const sfnt = sfntFromWoff(await readFile(source));
    await writeIfChanged(target, sfnt);
    fonts[name] = { ...face, path: target, font: createFont(sfnt) };
  }
  await writeIfChanged(
    FONTCONFIG_FILE,
    Buffer.from(
      '<?xml version="1.0"?>\n' +
        '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n' +
        '<fontconfig>\n' +
        '  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n' +
        `  <dir>${escapeXml(FONT_SCRATCH)}</dir>\n` +
        `  <cachedir>${escapeXml(path.join(FONT_SCRATCH, 'cache'))}</cachedir>\n` +
        '</fontconfig>\n',
      'utf8',
    ),
  );
  process.env.FONTCONFIG_FILE = FONTCONFIG_FILE;
  return fonts;
}

// --- text measurement and wrapping ------------------------------------------

function ascentPx(font, size) {
  return (font.ascent * size) / font.unitsPerEm;
}

function textWidth(font, text, size, letterSpacing = 0) {
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  const advance = run.positions.reduce(
    (total, position) => total + position.xAdvance,
    0,
  );
  return advance * scale + Math.max(0, text.length - 1) * letterSpacing;
}

/** Greedy word wrap. Returns every line, including any line that still overflows. */
function wrapText(font, text, size, maxWidth) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || textWidth(font, candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function missingGlyphs(font, text) {
  const missing = new Set();
  for (const character of String(text ?? '')) {
    if (character === '\n' || character === '\r') continue;
    if (!font.hasGlyphForCodePoint(character.codePointAt(0)))
      missing.add(character);
  }
  return [...missing];
}

/**
 * Choose the largest size in the ladder whose wrapped copy fits the line limit.
 * Overflow is reported as a violation, never silently clipped.
 */
function fitField({ field, kind, face, text, maxWidth }) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  let overflow = null;
  for (const size of face.sizes) {
    const lines = wrapText(face.font, value, size, maxWidth);
    const widest = Math.max(
      ...lines.map((line) => textWidth(face.font, line, size)),
    );
    if (lines.length <= face.lines && widest <= maxWidth) {
      return {
        field,
        kind,
        size,
        lines,
        lineHeight: face.lineHeight,
        weight: face.weight,
      };
    }
    overflow = { field, kind, size, lines: lines.length, maxLines: face.lines };
  }
  return { field, kind, error: overflow };
}

// --- SVG --------------------------------------------------------------------

function slideDocument({ width, height, blocks, rules, labels }) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${TOKENS.background}"/>`,
  ];
  for (const rule of rules) {
    parts.push(
      `<rect x="${rule.x}" y="${rule.y}" width="${rule.width}" height="${rule.height}" fill="${TOKENS.rule}"/>`,
    );
  }
  for (const label of labels) {
    if (!label.value) continue;
    const anchor = label.anchor ? ` text-anchor="${label.anchor}"` : '';
    const spacing = label.letterSpacing
      ? ` letter-spacing="${label.letterSpacing}"`
      : '';
    parts.push(
      `<text x="${label.x}" y="${label.y}" font-family="${FONT_FAMILY}" font-size="${label.size}"` +
        ` font-weight="${label.weight}"${spacing}${anchor} fill="${label.fill}">${escapeXml(label.value)}</text>`,
    );
  }
  for (const block of blocks) {
    for (const [index, line] of block.lines.entries()) {
      const baseline =
        block.top +
        ascentPx(block.font, block.size) +
        index * block.size * block.lineHeight;
      parts.push(
        `<text x="${block.x}" y="${baseline.toFixed(2)}" font-family="${FONT_FAMILY}" font-size="${block.size}"` +
          ` font-weight="${block.weight}" fill="${block.fill}">${escapeXml(line)}</text>`,
      );
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

/** Understated slide number, e.g. `03/07`. */
function defaultCounter(index, totalSlides) {
  if (!totalSlides) return '';
  return `${String(index).padStart(2, '0')}/${String(totalSlides).padStart(2, '0')}`;
}

/** Deterministic geometry for one slide, or the overflow violations that block it. */
function layoutSlide(slide, { width, height, fonts, totalSlides = 0 }) {
  const pad = LAYOUT.padding;
  const left = pad.left;
  const right = width - pad.right;
  const contentWidth = right - left;
  const contentTop = pad.top + LAYOUT.headerRuleOffset + LAYOUT.contentGap;
  const footerRule = height - pad.bottom - LAYOUT.footerRuleOffset;

  const title = fitField({
    field: 'title',
    kind: slide.kind,
    face: { ...TYPE[slide.kind].title, font: fonts.bold.font },
    text: slide.title,
    maxWidth: contentWidth,
  });
  const body = fitField({
    field: 'body',
    kind: slide.kind,
    face: { ...TYPE[slide.kind].body, font: fonts.regular.font },
    text: slide.body,
    maxWidth: contentWidth,
  });
  if (title?.error || body?.error) {
    return { violations: [title?.error, body?.error].filter(Boolean) };
  }

  const blocks = [];
  let cursor = contentTop;
  let lowestInk = contentTop;
  for (const field of [title, body]) {
    if (!field) continue;
    blocks.push({
      x: left,
      top: cursor,
      lines: field.lines,
      size: field.size,
      weight: field.weight,
      lineHeight: field.lineHeight,
      font: field.weight >= 700 ? fonts.bold.font : fonts.regular.font,
      fill: field.field === 'title' ? TOKENS.ink : TOKENS.inkSoft,
    });
    lowestInk = cursor + field.size * field.lineHeight * field.lines.length;
    cursor = lowestInk + (field.field === 'title' ? LAYOUT.titleGap : 0);
  }
  if (lowestInk > footerRule - LAYOUT.bodyGap) {
    return {
      violations: [
        {
          field: 'slide',
          kind: slide.kind,
          lines: 0,
          maxLines: 0,
          message:
            `copy needs ${Math.round(lowestInk)}px of vertical space but only ` +
            `${Math.round(footerRule - LAYOUT.bodyGap)}px is available`,
        },
      ],
    };
  }

  return {
    document: {
      width,
      height,
      blocks,
      rules: [
        {
          x: left,
          y: pad.top + LAYOUT.headerRuleOffset,
          width: contentWidth,
          height: LAYOUT.ruleHeight,
        },
        {
          x: left,
          y: footerRule,
          width: contentWidth,
          height: LAYOUT.ruleHeight,
        },
      ],
      labels: [
        {
          ...LAYOUT.kicker,
          x: left,
          y: pad.top + ascentPx(fonts.bold.font, LAYOUT.kicker.size),
          fill: TOKENS.inkSoft,
          value: String(slide.kicker ?? '').toUpperCase(),
        },
        {
          ...LAYOUT.counter,
          x: right,
          y: pad.top + ascentPx(fonts.regular.font, LAYOUT.counter.size),
          anchor: 'end',
          fill: TOKENS.inkSoft,
          value: String(
            slide.counter ?? defaultCounter(slide.index, totalSlides),
          ),
        },
        {
          ...LAYOUT.footer,
          x: left,
          y: height - pad.bottom,
          fill: TOKENS.inkSoft,
          value: String(slide.footer ?? ''),
        },
      ],
    },
  };
}

// --- rasterizing ------------------------------------------------------------

async function loadSharp() {
  try {
    const module = await import('sharp');
    return module.default;
  } catch (error) {
    throw new RendererUnavailable(
      `sharp is not installed; run \`npm ci\` (${error.message})`,
    );
  }
}

const fontProbeSvg = (family) =>
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="64">' +
      '<rect width="260" height="64" fill="#FFFFFF"/>' +
      `<text x="8" y="44" font-family="${family}" font-size="34" fill="#000000">RagWhy1</text></svg>`,
  );

/**
 * Fail loudly when the brand font does not resolve.
 *
 * SVG text with an unknown family silently falls back to whatever fontconfig
 * offers, which would ship the wrong typeface to readers. Rendering the same
 * string in the brand family and in a deliberately absent family yields
 * identical bytes exactly when fallback happened.
 */
async function assertBrandFontResolves(sharp) {
  const render = (family) => sharp(fontProbeSvg(family)).png().toBuffer();
  const [brand, absent] = await Promise.all([
    render(FONT_FAMILY),
    render('__absent-family__'),
  ]);
  if (brand.equals(absent)) {
    throw new RendererUnavailable(
      `the ${FONT_FAMILY} brand font did not resolve and would silently fall back; check ${FONTCONFIG_FILE}`,
    );
  }
}

/**
 * Authoritative guard: no ink may reach the outer margin band.
 *
 * Wrapping is decided from font metrics, so it is only as trustworthy as the
 * measurement. This inspects the pixels that were actually written.
 */
async function assertSafeArea(sharp, jpeg, width, height) {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const expected = Buffer.from(
    TOKENS.background
      .slice(1)
      .match(/../g)
      .map((pair) => parseInt(pair, 16)),
  );
  const inset = LAYOUT.safeInset;
  const channels = info.channels;
  for (let y = 0; y < height; y += 1) {
    const rowBand = y < inset || y >= height - inset;
    for (let x = 0; x < width; x += 1) {
      if (!rowBand && x >= inset && x < width - inset) {
        x = width - inset - 1;
        continue;
      }
      const offset = (y * info.width + x) * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        if (
          Math.abs(data[offset + channel] - expected[channel]) >
          LAYOUT.inkTolerance
        ) {
          throw new RendererFailure(
            `slide ink reached the ${inset}px safe margin at (${x}, ${y}); ` +
              'the layout refused to clip but the safe area was still breached',
          );
        }
      }
    }
  }
}

async function renderJob(job) {
  const width = Number(job.width ?? DEFAULTS.width);
  const height = Number(job.height ?? DEFAULTS.height);
  const quality = Number(job.quality ?? DEFAULTS.quality);
  const outputDir = String(job.outputDir ?? '');
  if (!outputDir) throw new RendererFailure('job is missing outputDir');
  if (!Array.isArray(job.slides) || job.slides.length === 0) {
    throw new RendererFailure('job carries no slides');
  }
  for (const slide of job.slides) {
    if (!KINDS.includes(slide.kind)) {
      throw new RendererFailure(
        `unknown slide kind ${JSON.stringify(slide.kind)}; expected one of ${KINDS.join(', ')}`,
      );
    }
  }

  const fonts = await prepareFonts();
  const sharp = await loadSharp();
  await assertBrandFontResolves(sharp);
  await mkdir(outputDir, { recursive: true });
  // Start from a clean directory so a slide dropped from a shorter carousel can
  // never linger and be published as if it belonged to the current one.
  for (const entry of await readdir(outputDir)) {
    if (/\.jpe?g$/i.test(entry)) await rm(path.join(outputDir, entry));
  }

  const rendered = [];
  const violations = [];
  for (const slide of job.slides) {
    const layout = layoutSlide(slide, {
      width,
      height,
      fonts,
      totalSlides: job.slides.length,
    });
    if (layout.violations) {
      violations.push(
        ...layout.violations.map((item) => ({
          slide: slide.index,
          kind: slide.kind,
          ...item,
        })),
      );
      continue;
    }
    const fields = {
      title: fonts.bold.font,
      kicker: fonts.bold.font,
      body: fonts.regular.font,
      footer: fonts.regular.font,
    };
    for (const [field, font] of Object.entries(fields)) {
      const missing = missingGlyphs(font, slide[field]);
      if (missing.length > 0) {
        throw new RendererFailure(
          `slide ${slide.index} ${field} uses characters the brand font has no glyph for: ` +
            missing.map((character) => JSON.stringify(character)).join(', '),
        );
      }
    }
    const svg = Buffer.from(slideDocument(layout.document), 'utf8');
    const file = path.join(
      outputDir,
      `slide-${String(slide.index).padStart(2, '0')}.jpg`,
    );
    const { data, info } = await sharp(svg)
      .jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (info.width !== width || info.height !== height) {
      throw new RendererFailure(
        `slide ${slide.index} rendered ${info.width}x${info.height} instead of ${width}x${height}`,
      );
    }
    await assertSafeArea(sharp, data, width, height);
    await writeFile(file, data);
    rendered.push({
      index: slide.index,
      kind: slide.kind,
      path: file,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      width,
      height,
    });
    process.stderr.write(
      `rendered slide ${slide.index}/${job.slides.length} (${data.length} bytes)\n`,
    );
  }
  return { rendered, violations };
}

async function main() {
  const raw = await readStdin();
  let job;
  try {
    job = JSON.parse(raw);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ error: 'invalid_job', message: error.message })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  try {
    const result = await renderJob(job);
    if (result.violations.length > 0) {
      process.stdout.write(
        `${JSON.stringify({ error: 'content_overflow', violations: result.violations })}\n`,
      );
      process.exitCode = 3;
      return;
    }
    process.stdout.write(
      `${JSON.stringify({
        renderer: 'svg-sharp',
        font: {
          family: FONT_FAMILY,
          source: 'public/fonts/*.woff',
          container: 'sfnt',
        },
        slides: result.rendered,
      })}\n`,
    );
  } catch (error) {
    const unavailable = error instanceof RendererUnavailable;
    process.stdout.write(
      `${JSON.stringify({
        error: unavailable ? 'renderer_unavailable' : 'render_failed',
        message: error.message,
      })}\n`,
    );
    process.exitCode = unavailable ? 4 : 1;
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}

export {
  FONT_FACES,
  KINDS,
  LAYOUT,
  RendererFailure,
  RendererUnavailable,
  TOKENS,
  TYPE,
  assertSafeArea,
  layoutSlide,
  renderJob,
  sfntFromWoff,
  slideDocument,
  textWidth,
  wrapText,
};
