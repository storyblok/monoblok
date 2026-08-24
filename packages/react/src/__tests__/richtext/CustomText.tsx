import type { StoryblokReactRichTextProps } from "@storyblok/react";

export default function CustomText({ text, context }: StoryblokReactRichTextProps<"text">) {
  const data = context?.data as { prefix: string } | undefined;
  const prefix = data?.prefix ?? "";
  return (
    <>
      {prefix} {text.toUpperCase()}
    </>
  );
}
