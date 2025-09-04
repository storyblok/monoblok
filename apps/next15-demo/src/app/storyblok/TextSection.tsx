import { storyblokEditable } from "@storyblok/react";
import type { TextSection } from "@/lib/types";
import { StoryblokRichText } from "@storyblok/react";
import clsx from "clsx";
import Button from "../components/Button";

export default function TextSection({ blok }: { blok: TextSection }) {
  return (
    <section
      className="page-section text-section py-16 lg:py-24"
      {...storyblokEditable(blok)}
    >
      <div className="container">
        <div
          className={clsx("max-w-3xl", {
            "mx-auto text-center": blok.text_alignment === "center",
            "text-left": blok.text_alignment === "left",
          })}
        >
          {blok.text && (
            <div className="prose prose-lg">
              <StoryblokRichText doc={blok.text} />
            </div>
          )}
          {blok.buttons && blok.buttons.length > 0 && (
            <div
              className={clsx("flex flex-col gap-4 sm:flex-row", {
                "justify-center": blok.text_alignment === "center",
                "justify-start items-start": blok.text_alignment === "left",
              })}
            >
              {blok.buttons.map((button) => (
                <Button key={button._uid} button={button} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
