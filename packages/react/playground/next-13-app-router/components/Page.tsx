import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock, StoryblokRichText } from "@/lib/storyblok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

type PageProps = StoryblokBlockComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block, editable }: PageProps) => (
  <main {...editable}>
    {block.body.map((nestedBlock) => (
      <StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
    ))}
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </main>
);

export default Page;
