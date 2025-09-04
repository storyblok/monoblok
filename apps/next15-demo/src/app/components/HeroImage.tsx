import { useMemo } from "react";
import type { HeroSection } from "../../../.storyblok/types/286726323865714/storyblok-components";
import DecorationImageTopLeft from "./DecorationImageTopLeft";
import DecorationImageBottomRight from "./DecorationImageBottomRight";
import clsx from "clsx";

interface HeroImageProps {
  blok: HeroSection;
  layout?: string;
  backgroundColor?: string;
}

export default function HeroImage({
  blok,
  layout,
  backgroundColor,
}: HeroImageProps) {
  const getOptimizedImage = (image: any, width: number, height: number = 0) => {
    if (!image?.filename) return null;
    const dimensions = height > 0 ? `${width}x${height}` : `${width}x0`;
    return `${image.filename}/m/${dimensions}`;
  };

  const desktopImage = useMemo(() => {
    if (blok.layout === "stacked") {
      return getOptimizedImage(
        blok?.image,
        2000,
        blok.preserve_image_aspect_ratio ? 0 : 750
      );
    } else {
      return getOptimizedImage(
        blok?.image,
        1000,
        blok.preserve_image_aspect_ratio ? 0 : 1200
      );
    }
  }, [blok?.image, blok.layout, blok.preserve_image_aspect_ratio]);

  const mobileImage = useMemo(
    () =>
      getOptimizedImage(
        blok?.image,
        672,
        blok.preserve_image_aspect_ratio ? 0 : 448
      ),
    [blok?.image, blok.preserve_image_aspect_ratio]
  );

  return (
    <div
      className={clsx("relative", {
        "px-4 md:px-8 py-12 md:pt-20 lg:p-0": layout === "split",
        "px-4 md:px-8 lg:px-0 translate-y-12 md:translate-y-24":
          layout !== "split",
      })}
    >
      <div className="relative z-10">
        {blok.image_decoration && (
          <>
            <DecorationImageTopLeft className="absolute left-0 top-0 origin-top-left translate-x-[-20px] translate-y-[-25px] scale-50 md:translate-x-[-40px] md:translate-y-[-50px] md:scale-100" />
            <DecorationImageBottomRight className="absolute bottom-0 right-0 origin-bottom-right translate-x-[25px] translate-y-[25px] scale-50 md:translate-x-[50px] md:translate-y-[55px] md:scale-100" />
          </>
        )}
        {desktopImage && (
          <img
            className="invisible hidden h-auto w-full rounded-lg lg:visible lg:block"
            src={desktopImage}
            alt={blok.image?.alt || ""}
          />
        )}
        {mobileImage && (
          <img
            className="h-auto w-full rounded-lg lg:invisible lg:hidden"
            src={mobileImage}
            alt={blok.image?.alt || ""}
          />
        )}
      </div>
      {layout === "split" && (
        <div
          className={clsx(
            "pointer-events-none absolute left-1/2 top-0 z-0 h-full w-[200%] -translate-x-1/2 content-[''] lg:invisible lg:hidden",
            backgroundColor
          )}
        />
      )}
    </div>
  );
}
