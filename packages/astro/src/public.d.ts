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
  import type {
    StoryblokClient,
    StoryblokRichTextNode,
    StoryblokRichTextResolvers,
  } from '@storyblok/astro';
  /**
   * @experimental Converts a Storyblok RichText field into an HTML string.
   *
   * This API is still under development and may change in future releases.
   * It also relies on Astro’s experimental
   * [experimental_AstroContainer](https://docs.astro.build/en/reference/container-reference/) feature.
   *
   * @async
   * @param {StoryblokRichTextNode} richTextField - The root RichText node to convert.
   * @param {StoryblokRichTextResolvers} [customResolvers] - Optional custom resolvers
   *   for customizing how specific nodes or marks are transformed into HTML.
   * @returns {Promise<string>} A promise that resolves to the HTML string representation
   *   of the provided RichText content.
   *
   * @example
   * ```astro
   * ---
   * import { richTextToHTML } from '@storyblok/astro/client';
   * const { blok } = Astro.props;
   * const renderedRichText = await richTextToHTML(blok.text);
   * ---
   *
   * <div set:html={renderedRichText} />
   * ```
   */
  export function richTextToHTML(
    richTextField: StoryblokRichTextNode,
    customResolvers?: StoryblokRichTextResolvers
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
