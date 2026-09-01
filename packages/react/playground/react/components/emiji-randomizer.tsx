import { type FC, useState } from "react";
import type { StoryblokComponentProps } from "@storyblok/react";

type EmojiRandomizerProps = StoryblokComponentProps<{ label?: string }>;

/**
 * A component that displays a label and a random emoji that changes on click
 */
const EmojiRandomizer: FC<EmojiRandomizerProps> = ({ block }) => {
  const emojis = ["😊", "🎉", "🚀", "✨", "🌈", "🎨", "🎸", "🎮", "🍕", "🌺"];

  const [currentEmoji, setCurrentEmoji] = useState(
    () => emojis[Math.floor(Math.random() * emojis.length)],
  );

  const randomizeEmoji = () => {
    let newEmoji;
    do {
      newEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    } while (newEmoji === currentEmoji);

    setCurrentEmoji(newEmoji);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4 bg-gray-100 rounded-lg">
      <div className="text-6xl">{currentEmoji}</div>
      <button
        onClick={randomizeEmoji}
        className="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white transition-colors duration-200"
      >
        {block.label || "Randomize Emoji"}
      </button>
    </div>
  );
};

export default EmojiRandomizer;
