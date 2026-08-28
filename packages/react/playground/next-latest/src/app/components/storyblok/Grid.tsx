import { StoryblokComponent } from "@/lib/storyblok";
import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type GridProps = StoryblokComponentProps<{ columns: StoryblokBlockData[] }>;

const Grid = ({ block }: GridProps) => {
  if (!block?.columns) {
    return null;
  }

  return (
    <section>
      <div data-test="grid" className="grid grid-cols-3 gap-6" {...storyblokEditable(block)}>
        {block.columns?.map((column) => (
          <StoryblokComponent key={column._uid} block={column} />
        ))}
      </div>
    </section>
  );
};

export default Grid;
