import { parse } from '@wordpress/block-serialization-default-parser';

export interface WpBlock {
  blockName: string | null;
  attrs: Record<string, unknown>;
  innerBlocks: WpBlock[];
  innerHTML: string;
  innerContent: (string | null)[];
}

export function parseBlocks(content: string): WpBlock[] {
  const raw = parse(content) as WpBlock[];
  return raw.filter(b => b.blockName !== null || b.innerHTML.trim().length > 0);
}

export function* walkBlocks(blocks: WpBlock[]): Generator<WpBlock> {
  for (const b of blocks) {
    yield b;
    yield* walkBlocks(b.innerBlocks);
  }
}

/**
 * Reconstitute the rendered HTML of a block, including inner blocks at the
 * positions marked by `null` in `innerContent`. Used when a block (or a run of
 * prose blocks) is converted to a single Storyblok richtext field.
 */
export function blockToHtml(b: WpBlock): string {
  let html = '';
  let innerIdx = 0;
  for (const segment of b.innerContent) {
    if (segment === null) {
      const inner = b.innerBlocks[innerIdx++];
      if (inner) {
        html += blockToHtml(inner);
      }
    }
    else {
      html += segment;
    }
  }
  return html;
}
