import { StoryblokBlock } from "./storyblok";

// Idiomatic React: an arrow function assigned to a const. Its binding stays
// in the temporal dead zone until this line executes, unlike a hoisted
// `function Page() {}` declaration — this is what makes the import order
// below observable.
export const Page = ({ block }: { block: any }) => (
  <div data-testid="page">
    {block.body?.map((child: any) => (
      <StoryblokBlock key={child._uid} block={child} />
    ))}
  </div>
);
