import type { StoryblokReactRichTextProps } from "../renderer";
import { splitTableRows } from "@storyblok/richtext";
import { defineStoryblokComponents } from "../../define-storyblok-components";

const { StoryblokRichText } = defineStoryblokComponents({ components: {} });

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
