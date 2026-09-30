import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock, StoryblokRichText } from "../storyblok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

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
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </div>
);

export default Page;
