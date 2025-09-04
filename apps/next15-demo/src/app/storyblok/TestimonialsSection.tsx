import { storyblokEditable } from "@storyblok/react";
import type { Testimonial, TestimonialsSection } from "@/lib/types";
import { useMemo } from "react";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import getGridClasses from "@/lib/getGridClasses";

interface TestimonialsSectionComponentProps {
  blok: TestimonialsSection;
  index?: number;
}

export default function TestimonialsSectionComponent({
  blok,
  index,
}: TestimonialsSectionComponentProps) {
  const gridClasses = useMemo(() => getGridClasses(), []);

  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section testimonials-section relative bg-white"
    >
      <div className="container">
        <div className="text-center">
          {blok.headline && <Headline headline={blok.headline} index={index} />}
          {blok.lead && <Lead>{blok.lead}</Lead>}
        </div>
        {blok.testimonials && blok.testimonials.length > 0 && (
          <ul className={gridClasses}>
            {blok.testimonials.map((testimonial) => {
              if (typeof testimonial === "string") {
                return null;
              }

              return (
                <li
                  key={testimonial.uuid}
                  className="max-w-sm rounded-lg bg-primary-background p-6 xl:max-w-none xl:p-12"
                >
                  <blockquote className="text-lg">
                    {testimonial?.content?.quote}
                  </blockquote>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="aspect-square size-16 shrink-0 overflow-hidden rounded-full bg-white">
                      {testimonial?.content?.photo?.filename && (
                        <img
                          src={testimonial.content.photo.filename}
                          alt={testimonial.content.photo?.alt || ""}
                          width="64"
                          height="64"
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-black">{testimonial?.content?.name}</p>
                      <p>{testimonial?.content?.role}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
