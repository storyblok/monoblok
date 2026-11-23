import type { StoryblokReactRichTextProps } from "../renderer";

export default function CustomText({
  text,
  context,
}: StoryblokReactRichTextProps<"text", { prefix: string }>) {
  return (
    <>
      {context.data.prefix} {text.toUpperCase()}
    </>
  );
}
