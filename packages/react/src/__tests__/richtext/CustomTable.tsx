import type { StoryblokReactRichTextProps } from "@storyblok/react";
import { splitTableRows } from "@storyblok/richtext";
import { createRegistry } from "../../create-registry";

const { StoryblokRichText } = createRegistry({ components: {} });

export default function CustomTable({
  attrs,
  content,
  context,
}: StoryblokReactRichTextProps<"table">) {
  const { headerRows, bodyRows } = splitTableRows(content);

  return (
    <table {...attrs} className="custom-table">
      <thead>
        <StoryblokRichText document={headerRows} {...context} />
      </thead>
      <tbody>
        <StoryblokRichText document={bodyRows} {...context} />
      </tbody>
    </table>
  );
}
