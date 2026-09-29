import type { StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";
import type { Block } from "@/schema/blocks";

type PageProps = StoryblokBlockComponentProps<Block<"page">>;

const Page = ({ block, editable }: PageProps) => (
  <div {...editable} data-test="page">
    {block.body?.map((nestedBlock) => (
      <div key={nestedBlock._uid}>
        <StoryblokBlock block={nestedBlock} />
      </div>
    ))}
  </div>
);

export default Page;
