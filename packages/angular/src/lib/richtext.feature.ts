import { InjectionToken, Type, Injectable, inject } from '@angular/core';
import type { RendererAdapter, StoryblokSegmentType } from '@storyblok/richtext';

import {
  type StoryblokFeature,
  type StoryblokComponentLoader,
  BaseComponentResolver,
} from './components.feature';

/**
 * Map of Storyblok segment types to Angular components.
 * Supports both eager (direct) and lazy (dynamic import) loading.
 *
 * @example
 * ```typescript
 * // Eager loading (bundled immediately)
 * const components: StoryblokRichtextComponentsMap = {
 *   link: CustomLinkComponent,
 *   image: OptimizedImageComponent,
 * };
 *
 * // Lazy loading (loaded on-demand) - recommended
 * const components: StoryblokRichtextComponentsMap = {
 *   link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *   image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 * };
 * ```
 */
export type StoryblokRichtextComponentsMap = Partial<
  Record<StoryblokSegmentType, Type<unknown> | StoryblokComponentLoader>
>;

/**
 * Injection token for richtext component overrides.
 * Defaults to an empty map if not provided.
 */
export const STORYBLOK_RICHTEXT_COMPONENTS = new InjectionToken<StoryblokRichtextComponentsMap>(
  'STORYBLOK_RICHTEXT_COMPONENTS',
  { factory: () => ({}) },
);

/**
 * Service for resolving richtext components with lazy loading support.
 * Caches resolved components to avoid repeated dynamic imports.
 */
@Injectable({ providedIn: 'root' })
export class StoryblokRichtextResolver extends BaseComponentResolver<StoryblokSegmentType> {
  protected readonly registry = inject(STORYBLOK_RICHTEXT_COMPONENTS);

  /** Get all registered segment types (for determining which nodes become component nodes). */
  getRegisteredTypes(): StoryblokSegmentType[] {
    return this.getRegisteredKeys();
  }
}

/**
 * Registers custom components for richtext node rendering.
 * Supports both eager and lazy loading of components.
 *
 * @param components - Map of segment types to Angular components
 * @returns A feature to pass to `provideStoryblok()`
 *
 * @example
 * ```typescript
 * // Lazy loading (recommended)
 * provideStoryblok(
 *   { accessToken: 'your-token' },
 *   withStoryblokRichtextComponents({
 *     link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *     image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 *   })
 * )
 *
 * // Eager loading
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
 * Singleton Angular adapter instance.
 * Memoized to avoid creating new objects on every render.
 */
let angularAdapterInstance: RendererAdapter<AngularRenderNode> | null = null;

/**
 * Creates or returns the memoized renderer adapter that produces Angular-friendly AST nodes.
 * This adapter is used by `renderSegments` from `@storyblok/richtext`.
 */
export function createAngularAdapter(): RendererAdapter<AngularRenderNode> {
  if (angularAdapterInstance) {
    return angularAdapterInstance;
  }

  angularAdapterInstance = {
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

  return angularAdapterInstance;
}

/**
 * Generates a stable tracking key for an AngularRenderNode.
 * Used for optimal @for loop performance.
 */
export function getNodeTrackingKey(node: AngularRenderNode, index: number): string {
  if (isTextNode(node)) {
    // For text nodes, use index + hash of content for stability
    return `text-${index}-${node.length}`;
  }
  if (isTagNode(node)) {
    // For tag nodes, use tag name + index
    return `tag-${node.tag}-${index}`;
  }
  if (isComponentNode(node)) {
    // For component nodes, use component type + index
    return `comp-${node.component}-${index}`;
  }
  return `node-${index}`;
}
