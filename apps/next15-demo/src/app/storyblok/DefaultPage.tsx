import React from "react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../StoryblokComponent";
import type { DefaultPage } from "../../../.storyblok/types/286726323865714/storyblok-components";

const DefaultPageComponent = ({ blok }: { blok: DefaultPage }) => {
  return (
    <main {...storyblokEditable(blok as any)}>
      {blok.body?.map((blok) => (
        <StoryblokComponent blok={blok} key={blok._uid} />
      ))}
    </main>
  );
};

export default DefaultPageComponent;
