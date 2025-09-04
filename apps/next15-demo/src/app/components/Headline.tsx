import type { HeadlineSegment } from "@/lib/types";
import { storyblokEditable } from "@storyblok/react";

interface HeadlineProps {
  headline: HeadlineSegment[];
  color?: string;
  size?: "small" | "large" | "medium";
  index?: number;
}

function HeadlineSegmentComponent({ segment }: { segment: HeadlineSegment }) {
  const highlightClass =
    segment.highlight && segment.highlight !== "none"
      ? `text-${segment.highlight}`
      : "";

  return (
    <span {...storyblokEditable(segment)} className={highlightClass}>
      {segment.text}
    </span>
  );
}

export default function Headline({
  headline,
  color,
  size = "medium",
  index = 0,
}: HeadlineProps) {
  const sizeClasses = {
    small: "sm:text-3xl lg:text-4xl",
    large: "sm:text-5xl lg:text-6xl",
    medium: "sm:text-4xl lg:text-5xl",
  };

  const colorClass = color || "text-[--headline-color]";
  const Tag = index === 0 ? "h1" : "h2";

  return (
    <Tag
      className={`font-display font-black mb-3 md:mb-6 text-3xl ${sizeClasses[size]} ${colorClass}`}
    >
      {headline.map((segment) => (
        <HeadlineSegmentComponent key={segment._uid} segment={segment} />
      ))}
    </Tag>
  );
}
