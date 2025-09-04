"use client";
import { storyblokEditable } from "@storyblok/react";
import type { Banner } from "@/lib/types";
import { useMemo } from "react";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import Button from "../components/Button";

interface BannerComponentProps {
  blok: Banner;
  index?: number;
}

export default function BannerComponent({ blok, index }: BannerComponentProps) {
  const isSvg = useMemo(() => {
    if (!blok.background_image?.filename) {
      return false;
    }
    const detectFileExtension = blok.background_image.filename.split(".");
    return detectFileExtension[detectFileExtension.length - 1] === "svg";
  }, [blok.background_image]);

  const optimizedImage = useMemo(() => {
    if (isSvg) {
      return blok.background_image?.filename;
    }
    // For now, use the original image. You can implement getOptimizedImage later
    return blok.background_image?.filename;
  }, [blok.background_image, isSvg]);

  const showVideo = useMemo(() => {
    if (blok.background_image?.filename && !blok.background_video?.filename) {
      return false;
    } else if (blok.background_video?.filename) {
      return true;
    }
    return false;
  }, [blok.background_image, blok.background_video]);

  const imageClasses = useMemo(() => {
    let output = "absolute bottom-0 z-0";
    if (blok.background_image_cover) {
      output += " left-0 size-full object-cover";
      return output;
    }
    switch (blok.background_image_alignment) {
      case "center":
        output += " left-1/2 -translate-x-1/2";
        break;
      case "right":
        output += " right-0";
        break;
      case "left":
      default:
        output += " left-0";
    }
    switch (blok.background_image_width) {
      case "50":
        output += " w-9/12 md:w-1/2";
        break;
      case "75":
        output += " w-9/12";
        break;
      case "100":
      default:
        output += " w-full";
    }
    return output;
  }, [
    blok.background_image_cover,
    blok.background_image_alignment,
    blok.background_image_width,
  ]);

  const overlay = useMemo(() => {
    if (showVideo || (optimizedImage && blok.background_image_cover)) {
      return true;
    }
    return false;
  }, [showVideo, optimizedImage, blok.background_image_cover]);

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={`page-section banner-section relative flex min-h-[600px] items-center overflow-hidden bg-${blok?.background_color}`}
    >
      <div
        className={`container relative z-20 flex ${
          blok.text_alignment === "center" ? "justify-center text-center" : ""
        } ${overlay ? "text-white" : ""}`}
      >
        <div className="relative z-30 max-w-3xl">
          {blok.headline && (
            <Headline
              headline={blok.headline}
              index={index}
              color={overlay ? "text-white" : ""}
            />
          )}
          {blok.lead && <Lead>{blok.lead}</Lead>}
          {blok?.buttons && blok.buttons.length > 0 && (
            <div
              className={`flex flex-col gap-4 sm:flex-row ${
                blok.text_alignment === "center"
                  ? "justify-center"
                  : "justify-start items-start"
              }`}
            >
              {blok.buttons.map((button) => (
                <Button key={button._uid} button={button} />
              ))}
            </div>
          )}
        </div>
      </div>

      {overlay && (
        <div className="absolute left-0 top-0 z-10 size-full bg-black/30"></div>
      )}

      {showVideo && blok.background_video?.filename && (
        <video
          src={blok.background_video.filename}
          className="absolute left-0 top-0 z-0 size-full object-cover"
          autoPlay
          muted
          loop
        />
      )}

      {!showVideo && optimizedImage && (
        <img
          src={optimizedImage}
          alt={blok.background_image?.alt || ""}
          className={imageClasses}
        />
      )}
    </section>
  );
}
