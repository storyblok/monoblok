import type { SbReactRichTextProps } from '@storyblok/react';
import type { JSX } from 'react';

export default function CustomHeading({ children, attrs }: SbReactRichTextProps<'heading'>) {
  const level = attrs?.level || 1;
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag data-type="custom-heading" data-level={attrs?.level}>
      {children}
    </Tag>
  );
}
