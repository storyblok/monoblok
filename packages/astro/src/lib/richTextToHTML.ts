import {
  ComponentBlok,
  richTextResolver,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/js';
import { experimental_AstroContainer } from 'astro/container';
import StoryblokComponent from '@storyblok/astro/StoryblokComponent.astro';

// Lazily initialized Astro container (for rendering blok components)
let container: null | experimental_AstroContainer = null;

/**
 * @experimental Converts a Storyblok RichText field into an HTML string.
 *
 * This API is still under development and may change in future releases.
 * It also relies on Astro's experimental
 * [experimental_AstroContainer](https://docs.astro.build/en/reference/container-reference/) feature.
 *
 * @async
 * @param {StoryblokRichTextNode} richTextField - The root RichText node to convert.
 * @param {StoryblokRichTextOptions['tiptapExtensions']} [tiptapExtensions] - Optional custom
 *   tiptap extensions for customizing how specific nodes or marks are rendered.
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
export const richTextToHTML = async (
  richTextField: StoryblokRichTextNode,
  tiptapExtensions?: StoryblokRichTextOptions['tiptapExtensions'],
): Promise<string> => {
  // Create Astro container only once
  if (!container) {
    container = await experimental_AstroContainer.create();
  }

  // Collect async render results keyed by placeholder ID
  const asyncReplacements: Promise<{ id: string; result: string }>[] = [];

  const resolver = richTextResolver<string>({
    tiptapExtensions: {
      blok: ComponentBlok.configure({
        renderComponent: (blok: Record<string, unknown>, _id?: string) => {
          if (!blok || typeof blok !== 'object' || !container) {
            return '';
          }

          // Generate unique placeholder ID
          const id = crypto.randomUUID();
          const placeholder = `<!--ASYNC-${id}-->`;

          // Queue async render
          const promise = container
            .renderToString(StoryblokComponent, {
              props: { blok },
            })
            .then(result => ({ id, result }))
            .catch((err) => {
              console.error('Component rendering failed:', err);
              return { id, result: '<!-- Component render error -->' };
            });

          asyncReplacements.push(promise);
          return placeholder;
        },
      }),
      ...tiptapExtensions,
    },
  });

  let html = resolver.render(richTextField);
  // Wait for all async renders
  const results = await Promise.all(asyncReplacements);
  const replacements = new Map(
    results.map(({ id, result }) => [id, result ?? '']),
  );

  // Single-pass replacement using regex
  html = html.replace(/<!--ASYNC-([\w-]+)-->/g, (_, id: string) => {
    return replacements.get(id) ?? '';
  });

  return html;
};
