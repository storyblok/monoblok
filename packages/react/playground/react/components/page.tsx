import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent, StoryblokRichText } from "../storyblok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

type PageProps = StoryblokComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block, editable }: PageProps) => (
  <div {...editable} data-test="page">
    {block.body?.map((nestedBlock) => (
      <div key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </div>
    ))}
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </div>
);

export default Page;
