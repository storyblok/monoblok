/**
 * Custom heading component that internally uses StoryblokRichText.
 * This tests the infinite loop prevention - without it, this would cause:
 * HeadingWithRichText -> StoryblokRichText -> HeadingWithRichText -> ...
 */
import type { StoryblokReactRichTextProps } from "../renderer";
import { defineStoryblokComponents } from "../../define-storyblok-components";
import type { JSX } from "react";

const { StoryblokRichText } = defineStoryblokComponents({ components: {} });

export default function HeadingWithRichText({
  content,
  attrs,
  context,
}: StoryblokReactRichTextProps<"heading">) {
  const level = attrs?.level || 1;
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag data-type="recursive-heading" data-level={attrs?.level}>
      {content && <StoryblokRichText document={content} {...context} />}
    </Tag>
  );
}
