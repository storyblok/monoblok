import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent, StoryblokRichText } from "@/lib/storyblok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

type PageProps = StoryblokComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block, editable }: PageProps) => (
  <main {...editable}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </main>
);

export default Page;
