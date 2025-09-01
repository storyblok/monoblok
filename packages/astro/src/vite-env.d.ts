/// <reference types="vite/client" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    _storyblok_preview_data?: any;
  }
}
declare module 'virtual:import-storyblok-components' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

  export const storyblokComponents: Record<string, AstroComponentFactory>;
}

declare module 'virtual:storyblok-options' {
  import type { IntegrationOptions } from './lib/storyblok-integration';

  const options: IntegrationOptions;
  export default options;
}
declare module 'virtual:storyblok-init' {
  import type { StoryblokClient } from '@storyblok/js';
  /**
   * Storyblok API instance initialized with project credentials.
   * Available after `virtual:storyblok-init` is imported.
   */
  export const storyblokApiInstance: StoryblokClient;
}
