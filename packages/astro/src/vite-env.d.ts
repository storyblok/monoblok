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
  import type { IntegrationOptions } from '@storyblok/astro';

  const options: IntegrationOptions;
  export default options;
}
declare module 'virtual:storyblok-init' {
  import type { StoryblokClient } from '@storyblok/astro';

  export const storyblokApiInstance: StoryblokClient;
}

declare module '@storyblok/astro/StoryblokComponent.astro' {
  import type { SbBlokData } from '@storyblok/astro';

  function StoryblokComponent(
    _props: Record<string, unknown> & {
      /** The Storyblok blok data for this component (required) */
      blok: SbBlokData;
    }
  ): any;

  /** Renders a dynamic Storyblok component */
  export default StoryblokComponent;
}

declare module '@storyblok/astro/client' {
  import type {
    StoryblokClient,
    StoryblokRichTextNode,
    StoryblokRichTextOptions,
  } from '@storyblok/astro';
  /**
   * Converts a Storyblok RichText field into an HTML string.
   *
   * ⚠️ **Experimental**: This API is still under development and may change in future releases.
   *
   * @async
   * @param {StoryblokRichTextNode} richTextField - The Storyblok RichText field node to be converted.
   * @param {StoryblokRichTextOptions['resolvers']} [customResolvers] - Optional custom resolvers
   *   for handling specific node types or marks in the RichText structure.
   * @returns {Promise<string>} The generated HTML string representation of the RichText content.
   */
  export function richTextToHTML(
    richTextField: StoryblokRichTextNode,
    customResolvers?: StoryblokRichTextOptions['resolvers']
  ): Promise<string>;

  /**
   * Provides direct access to the initialized Storyblok API client instance.
   *
   * This is useful when you need to call the Storyblok CDN API directly,
   * for example inside an Astro API route, integration, or page code.
   *
   * @returns {StoryblokClient} The initialized Storyblok API client instance.
   *
   * @example
   * ```ts
   * import { storyblokApi } from '@storyblok/astro/client';
   *
   * const { data } = await storyblokApi.get('cdn/stories/home');
   * ```
   */
  export const storyblokApi: StoryblokClient;
}
