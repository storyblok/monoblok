/**
 * Public type declarations bundled with the Storyblok Astro SDK.
 * Provides IntelliSense, JSDoc, and type safety for SDK consumers.
 */

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
  import type { StoryblokClient } from '@storyblok/astro';

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
