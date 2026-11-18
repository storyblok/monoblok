import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokRichText } from "@storyblok/react";
import { StoryblokBlock } from "../storyblok";
import RichTextBlok from "./rich-text-blok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

const richTextComponents = { blok: RichTextBlok };

type PageProps = StoryblokBlockComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block, editable }: PageProps) => (
  <div {...editable} data-test="page">
    {block.body?.map((nestedBlock) => (
      <div key={nestedBlock._uid}>
        <StoryblokBlock block={nestedBlock} />
      </div>
    ))}
    {block.richText ? (
      <StoryblokRichText document={block.richText} components={richTextComponents} />
    ) : null}
  </div>
);

export default Page;
