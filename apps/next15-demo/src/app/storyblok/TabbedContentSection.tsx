"use client";
import { useState } from "react";
import { storyblokEditable } from "@storyblok/react";
import type { TabbedContentSection } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { StoryblokComponent } from "../StoryblokComponent";

const TabbedContentSectionComponent = ({
  blok,
}: {
  blok: TabbedContentSection;
}) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section
      {...storyblokEditable(blok as any)}
      className="page-section tabbed-content-section container bg-white"
    >
      <div className="mb-12 text-center">
        {blok.headline && (
          <h2 className="font-display font-black mb-3 md:mb-6 text-3xl sm:text-4xl lg:text-5xl text-[--headline-color]">
            {blok.headline.map((segment) => (
              <span
                key={segment._uid}
                className={`${segment.highlight && segment.highlight !== "none" ? `text-${segment.highlight}` : ""}`}
              >
                {segment.text}
              </span>
            ))}
          </h2>
        )}
        {blok.lead && <p className="text-lg">{blok.lead}</p>}
      </div>

      <div>
        <ul className="border-medium relative mb-8 flex w-full flex-col rounded-lg border p-1 lg:flex-row">
          {blok.entries?.map((entry, i) => (
            <li key={entry._uid} className="w-full">
              <button
                className={`focus-ring w-full cursor-pointer rounded-md px-6 py-3 text-center text-lg ${
                  i === activeTab
                    ? "bg-primary-dark text-white"
                    : "text-primary-dark"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(i);
                }}
              >
                {entry.headline}
              </button>
            </li>
          ))}
        </ul>

        {blok.entries?.map((entry, i) => (
          <section id={`entry-${entry._uid}`} key={entry._uid}>
            {i === activeTab ? (
              <StoryblokComponent blok={entry as any} />
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
};

export default TabbedContentSectionComponent;
