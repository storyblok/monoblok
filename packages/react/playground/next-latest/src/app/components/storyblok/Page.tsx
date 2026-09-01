import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";
import { StoryblokRichTextDoc } from "@storyblok/richtext";

type PageProps = StoryblokComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block }: PageProps) => (
  <main {...storyblokEditable(block)}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </main>
);

export default Page;
