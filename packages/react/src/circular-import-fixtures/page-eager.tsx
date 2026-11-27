import { StoryblokBlock } from "./storyblok-eager";

export const Page = ({ block }: { block: any }) => (
  <div data-testid="page">
    {block.body?.map((child: any) => (
      <StoryblokBlock key={child._uid} block={child} />
    ))}
  </div>
);
