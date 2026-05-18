import type { SbReactRichTextProps } from '@storyblok/react';

export default function CustomLink({ children, attrs }: SbReactRichTextProps<'link'>) {
  return (
    <a data-type="custom-link" href={attrs?.href ?? '#'} target={attrs?.target ?? '_self'}>{children}</a>
  );
}
