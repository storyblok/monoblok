import type { HeadlineSegment } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { storyblokEditable } from "@storyblok/react";

export default function HeadlineSegment({ blok }: { blok: HeadlineSegment }) {
  return (
    <span
      {...storyblokEditable(blok as any)}
      className={`text-${blok.highlight} storyblok__outline`}
    >
      {blok.text}
    </span>
  );
}
