import type { StoryblokReactRichTextProps } from "../renderer";
import { splitTableRows } from "@storyblok/richtext";
import { defineStoryblokBlocks } from "../../define-storyblok-blocks";

const { StoryblokRichText } = defineStoryblokBlocks({ components: {} });

export default function CustomTable({ content, context }: StoryblokReactRichTextProps<"table">) {
  const { headerRows, bodyRows } = splitTableRows(content);

  return (
    <table className="custom-table">
      <thead>
        <StoryblokRichText document={headerRows} {...context} />
      </thead>
      <tbody>
        <StoryblokRichText document={bodyRows} {...context} />
      </tbody>
    </table>
  );
}
