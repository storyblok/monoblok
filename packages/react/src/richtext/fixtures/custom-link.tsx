import type { StoryblokReactRichTextProps } from "../renderer";

export default function CustomLink({ children, attrs }: StoryblokReactRichTextProps<"link">) {
  return (
    <a
      data-type="custom-link"
      href={attrs?.href ?? ""}
      target={attrs?.target ?? "_blank"}
      {...attrs?.custom}
    >
      {children}
    </a>
  );
}
