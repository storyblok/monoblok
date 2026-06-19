import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react';
import {
  createRichTextRenderer,
  type StoryblokRichTextProps,
} from './richtext';
import type { SbBlokData } from '@storyblok/js';
import { createDefaultBlok } from './create-default-blok';

type DivProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;
type WrappedProps = StoryblokRichTextProps & DivProps & { wrapper?: true };
type UnwrappedProps = StoryblokRichTextProps & { wrapper: false };

export type SbRichTextProps = WrappedProps | UnwrappedProps;

export function createStoryblokRichText(
  StoryblokComponent: ComponentType<{ blok: SbBlokData }>,
) {
  const DefaultBlok = createDefaultBlok(StoryblokComponent);

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    wrapper = true,
    ...rest
  }: SbRichTextProps): ReactNode {
    const render = createRichTextRenderer({
      optimizeImage,
      components: {
        blok: DefaultBlok,
        ...components,
      },
    });

    const content = render(document);

    if (!wrapper) {
      return content;
    }

    return <div {...rest}>{content}</div>;
  };
}
