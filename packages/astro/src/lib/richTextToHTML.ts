import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import {
  richTextResolver,
  type StoryblokRichTextNode,
  type StoryblokRichTextOptions,
} from '@storyblok/js';
import { experimental_AstroContainer } from 'astro/container';
import { storyblokComponents } from 'virtual:import-storyblok-components';
import { toCamelCase } from '@storyblok/astro';
import options from 'virtual:storyblok-options';

interface AsyncReplacement {
  placeholder: string;
  promise: Promise<string>;
}

export const richTextToHTML = async (
  richTextField: StoryblokRichTextNode,
  customResolvers?: StoryblokRichTextOptions['resolvers'],
): Promise<string> => {
  const container = await experimental_AstroContainer.create();

  const asyncReplacements: AsyncReplacement[] = [];
  // Build the resolvers object
  const resolvers: StoryblokRichTextOptions['resolvers'] = {
    // Handle async components
    blok: (node) => {
      const componentBody = node.attrs?.body;
      if (!Array.isArray(componentBody)) {
        return '';
      }

      return componentBody
        .map((blok) => {
          const key = toCamelCase(blok.component as string);
          const componentFound: boolean = key in storyblokComponents;
          let Component: AstroComponentFactory;
          if (!componentFound) {
            if (!options.enableFallbackComponent) {
              throw new Error(
                `No component found for blok "${blok.component}". 
                 Make sure the component is:
                 • Registered in your astro.config.mjs, or
                 • Placed in the "/${options.componentsDir}/storyblok" folder, or
                 • Enable the "fallbackComponent" option to handle missing components.`,
              );
            }
            else {
              Component = storyblokComponents.FallbackComponent;
            }
          }
          else {
            Component = storyblokComponents[key];
          }

          const placeholder = `<!--ASYNC-${asyncReplacements.length}-->`;
          const promise = container.renderToString(Component, {
            props: { blok },
          });

          asyncReplacements.push({ placeholder, promise });
          return placeholder;
        })
        .join('\n');
    },

    // Add custom resolvers if provided
    ...customResolvers,
  };

  const resolver = richTextResolver({ resolvers });

  let html = resolver.render(richTextField);

  // Wait for all async operations and replace placeholders
  for (const { placeholder, promise } of asyncReplacements) {
    try {
      const result = await promise;
      html = html.replace(placeholder, result);
    }
    catch (error) {
      console.error('Component rendering failed:', error);
      html = html.replace(placeholder, '<!-- Component render error -->');
    }
  }

  return html;
};
