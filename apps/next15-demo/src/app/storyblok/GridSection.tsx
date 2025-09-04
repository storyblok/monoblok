import { storyblokEditable } from "@storyblok/react";
import type {
  GridSection,
  GridCard,
  PriceCard,
  ImageCard,
} from "../../../.storyblok/types/286726323865714/storyblok-components";
import { useMemo } from "react";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import Button from "../components/Button";
import GridCardComponent from "./GridCard";
import PriceCardComponent from "./PriceCard";
import ImageCardComponent from "./ImageCard";
import getGridClasses from "@/lib/getGridClasses";
import { Storybloks } from "../StoryblokComponent";

interface GridSectionComponentProps {
  blok: GridSection;
  index?: number;
}

const GridSectionComponent = ({ blok, index }: GridSectionComponentProps) => {
  const gridCardColor = useMemo(() => {
    return blok.background_color === "primary-background"
      ? "bg-white"
      : "bg-primary-background";
  }, [blok.background_color]);

  const gridClasses = useMemo(() => getGridClasses(blok.cols), [blok.cols]);

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={`page-section grid-section bg-${blok.background_color || "white"}`}
    >
      <div className="container">
        {blok.headline && (
          <div className="text-center">
            <Headline headline={blok.headline} index={index} />
          </div>
        )}
        {blok.lead && (
          <div className="text-center">
            <Lead>{blok.lead}</Lead>
          </div>
        )}
        {blok.cards && blok.cards.length > 0 && (
          <div
            className={`${gridClasses} ${!blok.headline && !blok.lead ? "lg:!mt-0" : ""}`}
          >
            <Storybloks bloks={blok.cards} />
          </div>
        )}
        {blok.button && blok.button.length > 0 && (
          <div className="mt-12 flex justify-center">
            {blok.button.map((button) => (
              <Button key={button._uid} button={button} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default GridSectionComponent;
