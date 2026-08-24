import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

const Page = ({ block }: { block: BlockContent & { body?: BlockContent[] } }) => (
  <main {...storyblokEditable(block)}>
    {(block.body ?? []).map((nested) => (
      <StoryblokComponent block={nested} key={nested._uid} />
    ))}
  </main>
);

export default Page;
