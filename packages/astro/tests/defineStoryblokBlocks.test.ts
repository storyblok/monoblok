import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Teaser from "./block-fixtures/Teaser.astro";
import Hero from "./block-fixtures/Hero.astro";

describe("defineStoryblokBlocks", () => {
  it("registers components and returns a StoryblokBlock component", () => {
    const { StoryblokBlock } = defineStoryblokBlocks({
      components: { teaser: Teaser },
    });

    expect(StoryblokBlock).toBeDefined();
  });

  it("keeps independent calls from sharing or overwriting each other's components", async () => {
    const { StoryblokBlock: ContentTypeBlock } = defineStoryblokBlocks({
      components: { teaser: Teaser },
    });
    const { StoryblokBlock: OtherBlock } = defineStoryblokBlocks({
      components: { hero: Hero },
    });

    const container = await AstroContainer.create();

    const teaserResult = await container.renderToString(ContentTypeBlock, {
      props: { block: { component: "teaser", headline: "Teaser" } },
    });
    expect(teaserResult).toContain("Teaser");

    const heroResult = await container.renderToString(OtherBlock, {
      props: { block: { component: "hero", headline: "Hero" } },
    });
    expect(heroResult).toContain("Hero");

    // Each component only resolves what it was itself configured with.
    const teaserMissingHero = await container.renderToString(ContentTypeBlock, {
      props: { block: { component: "hero", headline: "Hero" } },
    });
    expect(teaserMissingHero.trim()).toBe("");

    const heroMissingTeaser = await container.renderToString(OtherBlock, {
      props: { block: { component: "teaser", headline: "Teaser" } },
    });
    expect(heroMissingTeaser.trim()).toBe("");
  });

  it("forwards extra props declared via the generic to the resolved component", async () => {
    type ExtraComponentProps = { locale: string };

    const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>({
      components: { teaser: Teaser },
    });

    const container = await AstroContainer.create();
    const result = await container.renderToString(StoryblokBlock, {
      props: { block: { component: "teaser", headline: "Teaser" }, locale: "fr" },
    });

    expect(result).toContain("Teaser");
  });
});
