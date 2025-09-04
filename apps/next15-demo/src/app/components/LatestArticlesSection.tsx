import { storyblokEditable } from "@storyblok/react";
import type { LatestArticlesSection } from "../@/lib/types";
import { Storybloks } from "../StoryblokComponent";

export default function LatestArticlesSection({
  blok,
}: {
  blok: LatestArticlesSection;
}) {
  return (
    <section
      className="page-section latest-articles-section py-16 lg:py-24"
      {...storyblokEditable(blok)}
    >
      <div className="container">
        {blok.headline && (
          <div className="text-center mb-12">
            <Storybloks bloks={blok.headline} />
          </div>
        )}
        {blok.lead && (
          <div className="text-center mb-12 text-lg">{blok.lead}</div>
        )}
        {/* Latest articles would be fetched and rendered here */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Article cards would go here */}
        </div>
      </div>
    </section>
  );
}
