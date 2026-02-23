export { ComponentBlok } from './extensions/nodes';
export * from './richtext';
export * from './types';
export * from './utils/segment-richtext';

/**
 * Wraps a framework component (React, Vue, etc.) for use as a tag
 * in Tiptap's `renderHTML` DOMOutputSpec.
 *
 * Tiptap's `DOMOutputSpec` type only accepts strings at position 0,
 * but the Storyblok richtext resolver also handles component references.
 * Use this helper to satisfy TypeScript without a manual `as unknown as string` type assertion.
 *
 * @example
 * ```typescript
 * import { Mark } from '@tiptap/core';
 * import { asTag } from '@storyblok/vue'; // or @storyblok/react
 * import { RouterLink } from 'vue-router';
 *
 * const CustomLink = Mark.create({
 *   name: 'link',
 *   renderHTML({ HTMLAttributes }) {
 *     return [asTag(RouterLink), { to: HTMLAttributes.href }, 0];
 *   },
 * });
 * ```
 */
export function asTag(component: unknown): string {
  return component as string;
}
