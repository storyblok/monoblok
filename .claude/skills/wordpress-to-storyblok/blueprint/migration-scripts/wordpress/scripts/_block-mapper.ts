import type { AssetFieldValue, MultilinkFieldValue } from '@storyblok/migrations';

import { proseRunToRichtext } from './_richtext.js';
import type { WpBlock } from './_wp-blocks.js';

const PROSE_BLOCKS = new Set([
  'core/paragraph',
  'core/heading',
  'core/list',
  'core/list-item',
  'core/quote',
  'core/code',
  'core/preformatted',
  'core/table',
  'core/separator',
]);

const PROMOTABLE = new Set(['core/cover', 'core/group', 'core/columns']);
const PROMOTION_PREFIX = 'sbp-';

export interface MappedBlok {
  component: string;
  [field: string]: unknown;
}

export interface ExtractedField {
  value: string;
  wpAttachmentId?: number;
}

export interface MapBlocksOptions {
  assetForBlockAttr?: (key: string, value: unknown, wpAttachmentId?: number) => AssetFieldValue | null;
  linkForValue?: (value: string) => MultilinkFieldValue | null;
}

/** Stable, schema-friendly identifier for a WP block name. `core/cover` → `cover`, `acf/hero` → `acf_hero`. */
export function safeBlockName(blockName: string): string {
  return blockName.replace(/^core\//, '').replace(/[/-]/g, '_');
}

/**
 * For `wp:cover` / `wp:group` / `wp:columns` carrying a `className` like `sbp-hero`,
 * return the className as the effective component name (so the playground's
 * landing-section helpers surface as `sbp_hero` etc., not `cover` / `group`).
 * Any other block returns its `safeBlockName`.
 */
export function effectiveBlockName(b: WpBlock): string {
  if (!b.blockName) {
    return 'unknown_block';
  }
  if (PROMOTABLE.has(b.blockName) && typeof b.attrs?.className === 'string') {
    const promoted = (b.attrs.className as string)
      .split(/\s+/)
      .find(c => c.startsWith(PROMOTION_PREFIX));
    if (promoted) {
      return promoted.slice(PROMOTION_PREFIX.length).replace(/-/g, '_');
    }
  }
  return safeBlockName(b.blockName);
}

export function isProseBlock(b: WpBlock): boolean {
  return b.blockName !== null && PROSE_BLOCKS.has(b.blockName);
}

/**
 * Walk a flat list of WP blocks, grouping consecutive prose blocks into a single
 * `richtext` blok and converting every other block into its own Storyblok blok
 * (recursing into innerBlocks via the `body` field).
 */
export function mapBlocks(blocks: WpBlock[], options: MapBlocksOptions = {}): MappedBlok[] {
  const out: MappedBlok[] = [];
  let proseRun: WpBlock[] = [];

  const flushProse = () => {
    if (proseRun.length === 0) {
      return;
    }
    out.push({ component: 'richtext', body: proseRunToRichtext(proseRun) });
    proseRun = [];
  };

  for (const b of blocks) {
    if (isProseBlock(b)) {
      proseRun.push(b);
      continue;
    }
    flushProse();
    out.push(structuralBlokFromWp(b, options));
  }
  flushProse();

  return out;
}

/** Attr keys that are WordPress-internal and should not become Storyblok fields. */
const WP_INTERNAL_ATTRS = new Set(['id', 'className', 'style', 'layout']);

type InnerHtmlExtractor = (html: string, attrs: Record<string, unknown>) => Record<string, string | ExtractedField>;

function wpAttachmentId(attrs: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    if (typeof attrs[k] === 'number') return attrs[k];
  }
  return undefined;
}

/** Extract structured fields from innerHTML for blocks that store content there rather than in attrs. */
const INNER_HTML_EXTRACTORS = new Map<string, InnerHtmlExtractor>([
  ['core/button', (html) => {
    const fields: Record<string, string> = {};
    const hrefMatch = html.match(/href="([^"]*)"/);
    if (hrefMatch) {
      fields.url = hrefMatch[1];
    }
    const textMatch = html.match(/<a[^>]*>([^<]*)<\/a>/);
    if (textMatch) {
      fields.text = textMatch[1];
    }
    return fields;
  }],
  ['core/media-text', (html, attrs) => {
    const fields: Record<string, string | ExtractedField> = {};
    const srcMatch = html.match(/<img[^>]+src="([^"]*)"/);
    if (srcMatch) {
      fields.image = { value: srcMatch[1], wpAttachmentId: wpAttachmentId(attrs, 'mediaId', 'id') };
    }
    return fields;
  }],
  ['core/image', (html, attrs) => {
    const fields: Record<string, string | ExtractedField> = {};
    const srcMatch = html.match(/<img[^>]+src="([^"]*)"/);
    if (srcMatch) {
      fields.image = { value: srcMatch[1], wpAttachmentId: wpAttachmentId(attrs, 'id') };
    }
    const altMatch = html.match(/<img[^>]+alt="([^"]*)"/);
    if (altMatch && altMatch[1]) {
      fields.alt = altMatch[1];
    }
    const captionMatch = html.match(/<figcaption[^>]*>([^<]*)<\/figcaption>/);
    if (captionMatch && captionMatch[1]) {
      fields.caption = captionMatch[1];
    }
    return fields;
  }],
]);

export function extractInnerHtmlFields(b: WpBlock): Record<string, string | ExtractedField> {
  const extractor = INNER_HTML_EXTRACTORS.get(b.blockName ?? '');
  return extractor ? extractor(b.innerHTML, b.attrs ?? {}) : {};
}

function resolveValue(key: string, value: unknown, wpId: number | undefined, options: MapBlocksOptions): unknown {
  const asset = options.assetForBlockAttr?.(key, value, wpId);
  if (asset) {
    return asset;
  }
  if (typeof value === 'string' && options.linkForValue) {
    return options.linkForValue(value) ?? value;
  }
  return value;
}

function structuralBlokFromWp(b: WpBlock, options: MapBlocksOptions): MappedBlok {
  const blok: MappedBlok = { component: effectiveBlockName(b) };
  const attrs = b.attrs ?? {};
  const blockWpId = wpAttachmentId(attrs, 'id', 'mediaId');

  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || WP_INTERNAL_ATTRS.has(k)) {
      continue;
    }
    blok[k] = resolveValue(k, v, blockWpId, options);
  }

  for (const [k, raw] of Object.entries(extractInnerHtmlFields(b))) {
    if (k in blok) {
      continue;
    }
    const isDescriptor = typeof raw === 'object' && raw !== null;
    const value = isDescriptor ? (raw as ExtractedField).value : raw;
    const fieldWpId = isDescriptor ? (raw as ExtractedField).wpAttachmentId : blockWpId;
    blok[k] = resolveValue(k, value, fieldWpId, options);
  }

  if (typeof blok.alt === 'string' && blok.alt) {
    for (const v of Object.values(blok)) {
      if (v && typeof v === 'object' && (v as Record<string, unknown>).fieldtype === 'asset') {
        const asset = v as AssetFieldValue;
        asset.alt = blok.alt;
        if (asset.meta_data) {
          asset.meta_data.alt = blok.alt;
        }
        delete blok.alt;
        break;
      }
    }
  }

  if (b.innerBlocks.length > 0) {
    blok.body = mapBlocks(b.innerBlocks, options);
  }

  return blok;
}
