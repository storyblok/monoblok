import { StoryblokBlocks } from "@/lib/storyblok";
import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";

type GridProps = StoryblokBlockComponentProps<{ columns: BlockContent[] }>;

const Grid = ({ block, editable }: GridProps) => {
  if (!block?.columns) {
    return null;
  }

  return (
    <section>
      <div data-test="grid" className="grid grid-cols-3 gap-6" {...editable}>
        <StoryblokBlocks blocks={block.columns} />
      </div>
    </section>
  );
};

export default Grid;
