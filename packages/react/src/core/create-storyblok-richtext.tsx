import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react';
import {
  createRichTextRenderer,
  type StoryblokReactRichTextDocumentProps,
} from './richtext';
import type { SbBlokData } from '@storyblok/js';
import { createDefaultBlok } from './create-default-blok';

type DivProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;
type WrappedProps = StoryblokReactRichTextDocumentProps & DivProps & { wrapper?: true };
type UnwrappedProps = StoryblokReactRichTextDocumentProps & { wrapper: false };

export type SbRichTextProps = WrappedProps | UnwrappedProps;

export function createStoryblokRichText(
  StoryblokComponent: ComponentType<{ blok: SbBlokData }>,
) {
  const DefaultBlok = createDefaultBlok(StoryblokComponent);

  return function StoryblokRichText({
    document,
    optimizeImage,
    components,
    data,
    wrapper = true,
    ...rest
  }: SbRichTextProps): ReactNode {
    const render = createRichTextRenderer({
      optimizeImage,
      components: {
        blok: DefaultBlok,
        ...components,
      },
      data,
    });

    const content = render(document);

    if (!wrapper) {
      return content;
    }

    return <div {...rest}>{content}</div>;
  };
}
