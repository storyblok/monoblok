import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type PageProps = StoryblokComponentProps<{ body: BlockContent[] }>;

const Page = ({ block, editable }: PageProps) => (
  <main {...editable}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
  </main>
);

export default Page;
