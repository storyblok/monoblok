"use client";

import { type FC, useEffect, useState } from "react";
import type { BlockContent } from "@storyblok/react";

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
}

const EmojiRandomizer: FC<{ block: BlockContent & { label?: string } }> = ({ block }) => {
  const emojis = ["😊", "🎉", "🚀", "✨", "🌈", "🎨", "🎸", "🎮", "🍕", "🌺"];
  const [currentEmoji, setCurrentEmoji] = useState(
    () => emojis[Math.floor(Math.random() * emojis.length)],
  );
  const isClient = useIsClient();

  if (!isClient) return null;

  const randomizeEmoji = () => {
    let next: string;
    do {
      next = emojis[Math.floor(Math.random() * emojis.length)];
    } while (next === currentEmoji);
    setCurrentEmoji(next);
  };

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
      <div className="text-6xl">{currentEmoji}</div>
      <button
        onClick={randomizeEmoji}
        className="rounded-lg bg-blue-500 px-6 py-3 font-small text-white transition-colors duration-200 hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800"
      >
        {block.label ?? "Randomize Emoji"}
      </button>
    </div>
  );
};

export default EmojiRandomizer;
