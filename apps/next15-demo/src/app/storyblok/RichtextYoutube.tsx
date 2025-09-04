import { storyblokEditable } from "@storyblok/react";
import type { RichtextYoutube } from "@/lib/types";

export default function RichtextYoutubeComponent({
  blok,
}: {
  blok: RichtextYoutube;
}) {
  if (!blok.video_id) return null;
  return (
    <div {...storyblokEditable(blok as any)} className="aspect-video w-full">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${blok.video_id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
