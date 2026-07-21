// REAL — Dipankar's SDK resolver, inlined verbatim.
// Source: https://github.com/dipankarmaikap/storyblok-react-sdk/blob/main/packages/react/src/create-resolver.ts
import type { ElementType, ReactNode } from 'react';
import type { SbBlokData } from './types';

export type ComponentMap = Record<string, ElementType>;

export type ResolverConfig = {
  fallback?: ElementType;
  suspenseFallback?: ElementType | ReactNode;
  suspenseFallbacks?: Record<string, ElementType | ReactNode>;
  cacheKeys?: Record<string, (blok: SbBlokData) => unknown>;
  warnMissingComponents?: boolean;
};

export type StoryblokResolver = (blockName: string) => ElementType | null;

export function createResolver(
  components: ComponentMap,
  config?: ResolverConfig,
): StoryblokResolver {
  return function resolve(blockName: string): ElementType | null {
    const Component = components[blockName];
    if (Component) {
      return Component;
    }
    if (config?.fallback) {
      return config.fallback;
    }
    if (config?.warnMissingComponents !== false) {
      // eslint-disable-next-line no-console
      console.warn(`[Storyblok SDK] Component "${blockName}" is not registered.`);
    }
    return null;
  };
}
