import type { StoryblokBlockComponentProps } from "@storyblok/react";

type EmojiRandomizerProps = StoryblokBlockComponentProps<{ label?: string }>;

const EmojiRandomizer = ({ block, editable }: EmojiRandomizerProps) => (
  <div data-test="emoji-randomizer" {...editable}>
    <span>🎉</span>
    <button type="button">{block.label || "Randomize Emoji"}</button>
  </div>
);

export default EmojiRandomizer;
