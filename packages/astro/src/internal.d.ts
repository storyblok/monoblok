/// <reference types="vite/client" />
/// <reference types="astro/client" />

/**
 * Internal type declarations used for building the Astro SDK.
 * Not published in the package — for local development only.
 */

declare namespace App {
  interface Locals {
    _storyblok_preview_data?: any;
  }
}

/** Registered Storyblok components mapped by name. */
declare module 'virtual:import-storyblok-components' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

  export const storyblokComponents: Record<string, AstroComponentFactory>;
}

/** Integration options provided to the Astro SDK. */
declare module 'virtual:storyblok-options' {
  import type { IntegrationOptions } from './lib/storyblok-integration';

  const options: IntegrationOptions;
  export default options;
}

declare module 'virtual:storyblok-init' {
  import type { StoryblokClient } from '@storyblok/astro';

  export const storyblokApiInstance: StoryblokClient;
}

// Dev stub. Real types come from the built package.
declare module '@storyblok/astro' {
  /** Converts a string to camelCase (internal helper). */
  export function toCamelCase(input: string): string;

  export type { SbBlokData } from '@storyblok/js';
  // add more exports as needed
}
