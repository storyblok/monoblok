import { storyblokEditable } from "@storyblok/react";
import type { LogoSection } from "@/lib/types";
import Lead from "../components/Lead";

export default function LogoSectionComponent({ blok }: { blok: LogoSection }) {
  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section logos-section bg-white"
    >
      <div className="container text-center">
        {blok.lead && <Lead>{blok.lead}</Lead>}
        {blok.logos && blok.logos.length > 0 && (
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-8 md:mt-16 md:gap-16">
            {blok.logos.map((logo) => (
              <li key={logo.id} className="max-w-20 shrink-0 md:max-w-28">
                {logo.filename && (
                  <img src={logo.filename} alt={logo.alt || ""} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
