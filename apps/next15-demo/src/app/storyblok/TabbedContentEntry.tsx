import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { TabbedContentEntry } from "@/lib/types";
import Button from "../components/Button";

export default function TabbedContentEntryComponent({
  blok,
}: {
  blok: TabbedContentEntry;
}) {
  const optimizedImage = blok.image?.filename
    ? `${blok.image.filename}/m/800x600`
    : undefined;

  return (
    <section
      {...storyblokEditable(blok)}
      className="grid rounded-lg bg-primary-background p-4 text-primary-dark md:grid-cols-2 md:p-8"
    >
      {blok.image?.filename && (
        <img
          src={optimizedImage}
          alt={(blok.image?.alt as string) || ""}
          className="rounded-lg md:order-1"
        />
      )}
      <div className="md:order-0 pt-4 md:p-4 md:pr-8">
        {blok.headline && (
          <h3 className="mb-6 font-display text-3xl font-black md:visible md:block">
            {blok.headline}
          </h3>
        )}
        {blok.description && (
          <div className="prose prose-lg">
            <StoryblokRichText doc={blok.description} />
          </div>
        )}
        {blok.button?.map((button) => (
          <div key={button._uid} className="mt-6">
            <Button button={button} />
          </div>
        ))}
      </div>
    </section>
  );
}
