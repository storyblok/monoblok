import type { SbReactRichTextProps } from '@storyblok/react';

export default function CustomHeading({ children, attrs }: SbReactRichTextProps<'heading'>) {
  return (
    <p data-type="custom-heading" data-level={attrs?.level}>
      {children}
    </p>
  );
}
