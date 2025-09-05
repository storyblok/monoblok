import {
  richTextResolver,
  type StoryblokRichTextNode,
  type StoryblokRichTextResolvers,
} from '@storyblok/js';
import { experimental_AstroContainer } from 'astro/container';
import StoryblokComponent from '@storyblok/astro/StoryblokComponent.astro';

const container = await experimental_AstroContainer.create();

/**
 * Converts a Storyblok RichText field into an HTML string.
 *
 * ⚠️ **Experimental**: This API is still under development and may change in future releases.
 *
 * @async
 * @param {StoryblokRichTextNode} richTextField - The Storyblok RichText field node to be converted.
 * @param {StoryblokRichTextResolvers} [customResolvers] - Optional custom resolvers
 *   for handling specific node types or marks in the RichText structure.
 * @returns {Promise<string>} The generated HTML string representation of the RichText content.
 */
export const richTextToHTML = async (
  richTextField: StoryblokRichTextNode,
  customResolvers?: StoryblokRichTextResolvers,
): Promise<string> => {
  const asyncReplacements: Promise<string>[] = [];
  // Build the resolvers object
  const resolvers: StoryblokRichTextResolvers = {
    // Handle async components
    blok: (node) => {
      const componentBody = node.attrs?.body;
      if (!Array.isArray(componentBody)) {
        return '';
      }

      return componentBody
        .map((blok) => {
          if (!blok || typeof blok !== 'object') {
            return '';
          }

          const placeholder = `<!--ASYNC-${asyncReplacements.length}-->`;
          const promise = container
            .renderToString(StoryblokComponent, {
              props: { blok },
            })
            .catch((err) => {
              console.error('Component rendering failed:', err);
              return '<!-- Component render error -->';
            });

          asyncReplacements.push(promise);
          return placeholder;
        })
        .join('\n');
    },

    // Add custom resolvers if provided
    ...customResolvers,
  };

  const resolver = richTextResolver({ resolvers });

  let html = resolver.render(richTextField);
  const results = await Promise.all(asyncReplacements);
  html = html.replace(/<!--ASYNC-(\d+)-->/g, (_, idx) => {
    const result = results[Number(idx)];
    return result ?? '';
  });

  return html;
};
