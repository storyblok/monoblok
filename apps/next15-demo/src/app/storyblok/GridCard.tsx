import { storyblokEditable } from "@storyblok/react";
import type { GridCard } from "@/lib/types";
import { useMemo } from "react";
import Button from "../components/Button";

interface GridCardComponentProps {
  blok: GridCard;
  backgroundColor?: string;
}

export default function GridCardComponent({
  blok,
  backgroundColor,
}: GridCardComponentProps) {
  const optimizedIcon = useMemo(() => {
    if (!blok.icon?.filename) return null;
    const isSvg = blok.icon.filename.slice(-3) === "svg";
    const optimize = isSvg ? "" : `/m/${blok.icon_width || 80}x0`;
    return blok.icon.filename + optimize;
  }, [blok.icon, blok.icon_width]);

  const optimizedImage = useMemo(() => {
    if (!blok.background_image?.filename) return null;
    // For now, use the original filename. In a real app, you'd implement image optimization
    return blok.background_image.filename;
  }, [blok.background_image]);

  return (
    <div
      {...storyblokEditable(blok)}
      className={`grid-blok relative flex size-full max-w-sm grow flex-col overflow-hidden rounded-lg p-6 lg:max-w-none ${
        blok.border ? "border-medium border" : backgroundColor || "bg-white"
      } ${blok.row_span === "2" ? "row-span-2" : ""} ${
        blok.icon?.filename ? "justify-between" : "justify-end"
      }`}
    >
      {optimizedImage && (
        <>
          <img
            src={optimizedImage}
            alt={blok.background_image?.alt || ""}
            className="absolute left-0 top-0 z-0 size-full object-cover"
          />
          <div className="absolute left-0 top-0 z-10 size-full bg-black/40"></div>
        </>
      )}

      {blok.icon?.filename && (
        <img
          src={optimizedIcon!}
          alt={blok.icon.alt || ""}
          width={blok.icon_width ? parseInt(blok.icon_width, 10) : 80}
          className="pointer-events-none relative z-10 mb-6"
        />
      )}

      <div className={`relative z-20 ${optimizedImage ? "text-white" : ""}`}>
        {blok.bold_text && (
          <p className="mb-3 text-4xl font-black">{blok.bold_text}</p>
        )}
        {blok.label && (
          <h3 className="mb-3 font-display text-xl font-black">{blok.label}</h3>
        )}
        {blok.text && <p className="leading-relaxed">{blok.text}</p>}
        {!!blok.button?.length && (
          <div className="mt-4">
            {blok.button.map((button) => (
              <Button key={button._uid} button={button} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
