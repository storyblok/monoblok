import { storyblokEditable } from "@storyblok/react";
import type { PersonalizedSection } from "@/lib/types";
import { Storybloks } from "../StoryblokComponent";

export default function PersonalizedSectionComponent({
  blok,
}: {
  blok: PersonalizedSection;
}) {
  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section personalized-section py-16 lg:py-24"
    >
      <div className="container">
        {blok.preview === "returning_visitor" ? (
          <Storybloks bloks={blok.returning_visitor_blocks} />
        ) : (
          <Storybloks bloks={blok.new_visitor_blocks} />
        )}
      </div>
    </section>
  );
}
