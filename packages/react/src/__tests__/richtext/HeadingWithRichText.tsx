/**
 * Custom heading component that internally uses StoryblokRichText.
 * This tests the infinite loop prevention - without it, this would cause:
 * HeadingWithRichText -> StoryblokRichText -> HeadingWithRichText -> ...
 */
import type { SbReactRichTextProps } from '@storyblok/react';
import { StoryblokRichText } from '@storyblok/react';
import type { JSX } from 'react';

export default function HeadingWithRichText({ content, attrs, context }: SbReactRichTextProps<'heading'>) {
  const level = attrs?.level || 1;
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag data-type="recursive-heading" data-level={attrs?.level}>
      {content && <StoryblokRichText wrapper={false} document={content} {...context} />}
    </Tag>
  );
}
