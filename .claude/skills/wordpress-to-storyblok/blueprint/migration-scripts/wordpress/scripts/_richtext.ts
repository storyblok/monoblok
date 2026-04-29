import { blockToHtml, type WpBlock } from './_wp-blocks.js';

/**
 * Richtext doc shape (Storyblok / TipTap-style ProseMirror JSON).
 * The CLI roundtrips this opaquely; full fidelity comes from `htmlToStoryblokRichtext`
 * (lazy-loaded so a broken transitive dep doesn't break the whole pipeline).
 */
type RichtextDoc = { type: 'doc'; content: unknown[] };

let cachedConverter: ((html: string) => RichtextDoc) | null | undefined;

async function getConverter(): Promise<((html: string) => RichtextDoc) | null> {
  if (cachedConverter !== undefined) {
    return cachedConverter;
  }
  try {
    const mod = await import('@storyblok/migrations');
    cachedConverter = (mod.htmlToStoryblokRichtext as (html: string) => RichtextDoc) ?? null;
  }
  catch (err) {
    console.warn('  htmlToStoryblokRichtext unavailable; richtext content will fall back to plain-text paragraphs.', (err as Error).message);
    cachedConverter = null;
  }
  return cachedConverter;
}

function fallbackParagraphs(html: string): RichtextDoc {
  const text = html
    .replace(/<\/?(p|h[1-6]|li|ul|ol|blockquote|pre|code|table|tr|td|th|thead|tbody|hr|br|div|span|figure|figcaption)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  const paragraphs = text.split(/\n+/).filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.map(t => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
  };
}

let convertSync: (html: string) => RichtextDoc = fallbackParagraphs;

// Eagerly resolve the real converter on module load so the rest of the script can stay synchronous.
await (async () => {
  const real = await getConverter();
  if (real) {
    convertSync = real;
  }
})();

export function proseRunToRichtext(blocks: WpBlock[]): RichtextDoc {
  const html = blocks.map(blockToHtml).join('\n');
  return convertSync(html);
}

export function htmlToRichtext(html: string): RichtextDoc {
  return convertSync(html);
}
