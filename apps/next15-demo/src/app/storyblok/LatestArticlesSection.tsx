import { storyblokEditable } from "@storyblok/react";
import type { LatestArticlesSection } from "@/lib/types";

export default function LatestArticlesSectionComponent({
  blok,
}: {
  blok: LatestArticlesSection;
}) {
  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section latest-articles-section py-16 lg:py-24"
    >
      <div className="container">
        {blok.headline && (
          <h2 className="font-display font-black mb-6 text-3xl sm:text-4xl">
            {blok.headline.map((s) => (
              <span key={s._uid}>{s.text}</span>
            ))}
          </h2>
        )}
        {blok.lead && <p className="text-lg">{blok.lead}</p>}
      </div>
    </section>
  );
}
