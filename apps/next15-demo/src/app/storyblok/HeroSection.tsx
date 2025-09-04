"use client";
import { storyblokEditable } from "@storyblok/react";
import type { HeroSection } from "../../../.storyblok/types/286726323865714/storyblok-components";
import clsx from "clsx";
import HeroContent from "../components/HeroContent";
import HeroImage from "../components/HeroImage";
import { useEffect } from "react";

const HeroSectionComponent = ({
  blok,
  index,
}: {
  blok: HeroSection;
  index?: number;
}) => {
  const secondaryBgClass = blok.secondary_background_color
    ? `bg-${blok.secondary_background_color}`
    : "bg-primary-highlight";

  // Dynamic nav background color - matches Nuxt demo behavior
  useEffect(() => {
    if (blok.background_color && blok.background_color !== "white") {
      // Create or update style element for nav background
      let styleElement = document.getElementById("hero-nav-bg-style");
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = "hero-nav-bg-style";
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = `:root { --nav-background-color: var(--color-${blok.background_color}); }`;
    } else {
      // Remove custom nav background, revert to default
      const styleElement = document.getElementById("hero-nav-bg-style");
      if (styleElement) {
        styleElement.remove();
      }
    }

    // Cleanup on unmount
    return () => {
      const styleElement = document.getElementById("hero-nav-bg-style");
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [blok.background_color]);

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={clsx("relative", `bg-${blok.background_color}`, {
        "overflow-hidden pt-20 lg:pb-16 lg:pt-20": blok.layout === "split",
        "pt-16 lg:pt-32": blok.layout === "stacked",
      })}
    >
      {blok.layout === "stacked" && (
        <div className="container relative z-20 mb-12 lg:mb-20">
          <HeroContent blok={blok} index={index} />
          <HeroImage blok={blok} layout={blok.layout} />
        </div>
      )}
      {blok.layout === "split" && (
        <div className="container relative z-20 grid items-center gap-12 lg:grid-cols-2 lg:gap-32">
          <HeroContent blok={blok} index={index} />
          <HeroImage
            blok={blok}
            layout={blok.layout}
            backgroundColor={secondaryBgClass}
          />
        </div>
      )}
      {blok.layout === "split" && (
        <div
          className={clsx(
            "pointer-events-none invisible absolute left-1/2 top-0 z-10 hidden h-full w-1/2 content-[''] lg:visible lg:block",
            secondaryBgClass
          )}
        ></div>
      )}
    </section>
  );
};

export default HeroSectionComponent;
