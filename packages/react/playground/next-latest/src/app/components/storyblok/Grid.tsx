import { StoryblokComponent } from "@/lib/storyblok";
import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";

type GridProps = StoryblokComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block?.columns) {
    return null;
  }

  return (
    <section>
      <div data-test="grid" className="grid grid-cols-3 gap-6" {...editable}>
        {block.columns?.map((column) => (
          <StoryblokComponent key={column._uid} block={column} />
        ))}
      </div>
    </section>
  );
};

export default Grid;
