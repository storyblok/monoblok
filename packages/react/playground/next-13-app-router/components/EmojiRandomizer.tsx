"use client";

import { useState } from "react";
import type { StoryblokBlockComponentProps } from "@storyblok/react";

type EmojiRandomizerProps = StoryblokBlockComponentProps<{ label?: string }>;

const EMOJIS = ["🎉", "😊", "🚀", "✨", "🌈", "🎨", "🎸", "🎮", "🍕", "🌺"];

const EmojiRandomizer = ({ block, editable }: EmojiRandomizerProps) => {
  // Start from a fixed emoji so the server and client render the same markup.
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const randomizeEmoji = () => {
    const others = EMOJIS.filter((candidate) => candidate !== emoji);
    setEmoji(others[Math.floor(Math.random() * others.length)]);
  };

  return (
    <div data-test="emoji-randomizer" {...editable}>
      <span>{emoji}</span>
      <button type="button" onClick={randomizeEmoji}>
        {block.label || "Randomize Emoji"}
      </button>
    </div>
  );
};

export default EmojiRandomizer;
