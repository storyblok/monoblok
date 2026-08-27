import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import { StoryblokComponent } from "../storyblok";
import type { StoryblokRichTextDoc } from "@storyblok/richtext";

type PageProps = StoryblokComponentProps<{
  body: StoryblokBlockData[];
  richText: StoryblokRichTextDoc;
}>;

const Page = ({ block }: PageProps) => (
  <div {...storyblokEditable(block)} data-test="page">
    {block.body?.map((nestedBlock) => (
      <div key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </div>
    ))}
    {block.richText ? <StoryblokRichText document={block.richText} /> : null}
  </div>
);

export default Page;
