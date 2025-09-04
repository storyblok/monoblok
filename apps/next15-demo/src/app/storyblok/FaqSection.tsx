import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { FaqSection } from "@/lib/types";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import Decoration2 from "../components/Decoration2";

interface FaqSectionComponentProps {
  blok: FaqSection;
  index?: number;
}

export default function FaqSectionComponent({
  blok,
  index,
}: FaqSectionComponentProps) {
  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section faq-section relative bg-primary-background"
    >
      <div className="container relative z-10 grid gap-10 xl:grid-cols-2">
        <div>
          {blok.headline && (
            <Headline headline={blok.headline} index={index} size="small" />
          )}
          {blok.lead && <Lead>{blok.lead}</Lead>}
        </div>
        {blok.faq_entries && blok.faq_entries.length > 0 && (
          <ul>
            {blok.faq_entries.map((entry) => (
              <li
                key={entry._uid}
                className="border-b border-primary-dark py-8 last:border-none last:pb-0 last:pt-8"
              >
                <details className="relative">
                  <summary className="focus-ring cursor-pointer list-none pr-6 text-xl font-medium">
                    {entry.question}
                  </summary>
                  {entry.answer && (
                    <div className="prose mt-4">
                      <StoryblokRichText doc={entry.answer} />
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Decoration2 className="absolute bottom-0 left-0 z-0" />
    </section>
  );
}
