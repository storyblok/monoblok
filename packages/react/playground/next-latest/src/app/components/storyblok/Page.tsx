import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokRichText } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";
import RichTextBlok from "@/app/components/storyblok/RichTextBlok";
import { StoryblokRichTextDoc } from "@storyblok/richtext";

const richTextComponents = { blok: RichTextBlok };

type PageProps = StoryblokBlockComponentProps<{
  body: BlockContent[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block, editable }: PageProps) => (
  <main {...editable}>
    {block.body.map((nestedBlock) => (
      <StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
    ))}
    {block.richText ? (
      <StoryblokRichText document={block.richText} components={richTextComponents} />
    ) : null}
  </main>
);

export default Page;
