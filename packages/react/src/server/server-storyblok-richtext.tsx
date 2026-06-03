import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createRichTextRenderer, type SbReactRichTextProps, type StoryblokRichTextProps } from '../core/richtext';
import StoryblokServerComponent from './server-component';

/**
 * Default blok renderer.
 * Module-scoped so identity is stable across renders.
 */
export function DefaultBlok({ attrs }: SbReactRichTextProps<'blok'>) {
  if (!Array.isArray(attrs?.body)) {
    return null;
  }

  return attrs.body.map((blok, index) => (
    <StoryblokServerComponent
      blok={blok}
      key={blok._uid || index}
    />
  ));
}

type DivProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;
type WrappedProps = StoryblokRichTextProps & DivProps & { wrapper?: true };
type UnwrappedProps = StoryblokRichTextProps & { wrapper: false };

export type SbRichTextProps = WrappedProps | UnwrappedProps;

export function StoryblokServerRichText({
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
}
