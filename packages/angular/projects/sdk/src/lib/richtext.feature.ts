import { InjectionToken, Type } from '@angular/core';
import type { RendererAdapter, StoryblokSegmentType } from '@storyblok/richtext';
import type { StoryblokFeature } from './components.feature';

/**
 * Map of Storyblok segment types to Angular components.
 * Use this to override rendering of specific rich text node types.
 *
 * @example
 * ```typescript
 * const components: StoryblokRichtextComponentsMap = {
 *   link: CustomLinkComponent,
 *   image: OptimizedImageComponent,
 *   heading: CustomHeadingComponent,
 * };
 * ```
 */
export type StoryblokRichtextComponentsMap = Partial<Record<StoryblokSegmentType, Type<unknown>>>;

/**
 * Injection token for richtext component overrides.
 * Defaults to an empty map if not provided.
 */
export const STORYBLOK_RICHTEXT_COMPONENTS = new InjectionToken<StoryblokRichtextComponentsMap>(
  'STORYBLOK_RICHTEXT_COMPONENTS',
  { factory: () => ({}) },
);

/**
 * Registers custom components for richtext node rendering.
 *
 * @param components - Map of segment types to Angular components
 * @returns A feature to pass to `provideStoryblok()`
 *
 * @example
 * ```typescript
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokRichtextComponents({
 *     link: CustomLinkComponent,
 *     image: OptimizedImageComponent,
 *   })
 * )
 * ```
 */
export function withStoryblokRichtextComponents(
  components: StoryblokRichtextComponentsMap,
): StoryblokFeature {
  return {
    ɵkind: 'richtext',
    ɵproviders: [{ provide: STORYBLOK_RICHTEXT_COMPONENTS, useValue: components }],
  };
}

/**
 * Represents a text node in the Angular render tree.
 */
export type AngularTextNode = string;

/**
 * Represents an HTML tag node in the Angular render tree.
 */
export interface AngularTagNode {
  tag: string;
  attrs?: Record<string, unknown>;
  children?: AngularRenderNode[];
}

/**
 * Represents a custom component node in the Angular render tree.
 */
export interface AngularComponentNode {
  component: StoryblokSegmentType;
  props: Record<string, unknown>;
  children?: AngularRenderNode[];
}

/**
 * Union type representing any node in the Angular render tree.
 */
export type AngularRenderNode = AngularTextNode | AngularTagNode | AngularComponentNode;

/**
 * Type guard to check if a node is a text node.
 */
export function isTextNode(node: AngularRenderNode): node is AngularTextNode {
  return typeof node === 'string';
}

/**
 * Type guard to check if a node is an HTML tag node.
 */
export function isTagNode(node: AngularRenderNode): node is AngularTagNode {
  return typeof node === 'object' && node !== null && 'tag' in node;
}

/**
 * Type guard to check if a node is a custom component node.
 */
export function isComponentNode(node: AngularRenderNode): node is AngularComponentNode {
  return typeof node === 'object' && node !== null && 'component' in node;
}

/**
 * Creates a renderer adapter that produces Angular-friendly AST nodes.
 * This adapter is used by `renderSegments` from `@storyblok/richtext`.
 */
export function createAngularAdapter(): RendererAdapter<AngularRenderNode> {
  return {
    createElement(tag, attrs = {}, children = []) {
      // Remove 'key' as it's React-specific
      const { key: _key, ...rest } = attrs;
      return { tag, attrs: rest, children };
    },

    createText(text) {
      return text;
    },

    createComponent(type, props) {
      const { children = [], key: _key, ...rest } = props;
      return {
        component: type as StoryblokSegmentType,
        props: rest,
        children: Array.isArray(children) ? (children as AngularRenderNode[]) : undefined,
      };
    },
  };
}
