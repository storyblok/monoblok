import { storyblokEditable } from "@storyblok/react";
import type { ImageCard } from "@/lib/types";
import { useMemo } from "react";

export default function ImageCardComponent({ blok }: { blok: ImageCard }) {
  const optimizedImage = useMemo(() => {
    if (!blok.image?.filename) return null;
    // Basic image optimization - you might want to implement getOptimizedImage function
    return blok.image.filename;
  }, [blok.image]);

  return (
    <div
      {...storyblokEditable(blok)}
      className="image-blok flex size-full flex-col"
    >
      <div
        className={`mb-6 max-w-sm justify-center overflow-hidden rounded-lg pb-0 pt-12 lg:max-w-none bg-${blok.background_color || "white"}`}
      >
        {optimizedImage && (
          <img
            src={optimizedImage}
            alt={blok.image?.alt || ""}
            className="h-[360px] w-full object-cover object-top"
          />
        )}
      </div>
      {blok.label && (
        <h3 className="mb-3 font-display text-xl font-black">{blok.label}</h3>
      )}
      {blok.text && <div className="leading-relaxed">{blok.text}</div>}
    </div>
  );
}
