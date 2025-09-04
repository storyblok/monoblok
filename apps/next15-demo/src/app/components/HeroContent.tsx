import type { HeroSection } from "../../../.storyblok/types/286726323865714/storyblok-components";
import Eyebrow from "./Eyebrow";
import Headline from "./Headline";
import Lead from "./Lead";
import Button from "./Button";
import clsx from "clsx";

interface HeroContentProps {
  blok: HeroSection;
  index?: number;
}

export default function HeroContent({ blok, index = 0 }: HeroContentProps) {
  return (
    <div
      className={clsx("max-w-3xl", {
        "mx-auto text-center": blok.text_alignment === "center",
      })}
    >
      {blok.eyebrow && <Eyebrow>{blok.eyebrow}</Eyebrow>}
      {blok.headline && (
        <Headline size="large" headline={blok.headline} index={index} />
      )}
      {blok.text && <Lead>{blok.text}</Lead>}
      {!!blok?.buttons?.length && (
        <div
          className={clsx("flex flex-col gap-4 sm:flex-row", {
            "justify-center": blok.text_alignment === "center",
            "justify-start items-start": blok.text_alignment !== "center",
          })}
        >
          {blok.buttons.map((button) => (
            <Button key={button._uid} button={button} />
          ))}
        </div>
      )}
    </div>
  );
}
