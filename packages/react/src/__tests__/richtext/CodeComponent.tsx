import type { StoryblokReactRichTextProps } from "@storyblok/react";

export default function CustomCodeBlock({
  children,
  attrs,
}: StoryblokReactRichTextProps<"code_block">) {
  return (
    <pre className={`language-${attrs?.class}`}>
      <code data-lang={attrs?.class}>{children}</code>
    </pre>
  );
}
