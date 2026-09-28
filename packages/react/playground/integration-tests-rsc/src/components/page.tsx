import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";
import type { Block } from "@/schema/blocks";

type PageProps = StoryblokComponentProps<Block<"page">>;

const Page = ({ block }: PageProps) => (
  <div {...storyblokEditable(block)} data-test="page">
    {block.body?.map((nestedBlock) => (
      <div key={nestedBlock._uid}>
        <StoryblokComponent block={nestedBlock} />
      </div>
    ))}
  </div>
);

export default Page;
