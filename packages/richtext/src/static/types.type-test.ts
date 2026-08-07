/**
 * Compile-time regression tests for the `StoryblokRichTextNode` / `StoryblokRichTextDoc`
 * contract reported in https://github.com/storyblok/monoblok/issues/16.
 *
 * The Storyblok API returns the root `doc` node with a `content` array, but
 * nested nodes (empty paragraphs, leaf nodes) may omit `content` entirely.
 * The types must mirror that: `content` is required on the document root and
 * optional on every other node.
 *
 * These assertions are checked by `pnpm typecheck` (`tsc --noEmit`) and are
 * intentionally never executed at runtime.
 */
import type { StoryblokRichTextDoc, StoryblokRichTextNode } from './index';

// A `doc` with a `content` array is valid.
export const docWithContent: StoryblokRichTextDoc = {
  type: 'doc',
  content: [],
};

// The document root must include `content`.
// @ts-expect-error - `content` is required on the `doc` node.
export const docWithoutContent: StoryblokRichTextDoc = {
  type: 'doc',
};

// Nested nodes may omit `content`. This is the exact case from #16 that the
// previous type wrongly rejected.
export const docWithContentlessChildren: StoryblokRichTextDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph' },
    { type: 'horizontal_rule' },
    {
      type: 'bullet_list',
      content: [{ type: 'list_item' }],
    },
  ],
};

// A bare nested node without `content` is assignable to `StoryblokRichTextNode`.
export const contentlessNode: StoryblokRichTextNode = {
  type: 'paragraph',
};
