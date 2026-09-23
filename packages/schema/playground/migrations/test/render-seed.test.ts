import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import home from "../.storyblok/stories/seed/home_story-home.json";
import pricing from "../.storyblok/stories/seed/pricing_story-pricing.json";
import team from "../.storyblok/stories/seed/team_story-team.json";
import translated from "../.storyblok/stories/seed/translated_story-translated.json";
import { schema } from "../src/schema/schema";
import StoryblokComponent from "../src/components/storyblok/storyblok-component.astro";

const SEED_STORIES = { home, team, pricing, translated };

async function renderSeedStories(): Promise<Record<string, string>> {
  const container = await AstroContainer.create();
  const rendered: Record<string, string> = {};
  for (const [slug, story] of Object.entries(SEED_STORIES)) {
    rendered[slug] = await container.renderToString(StoryblokComponent, {
      props: { block: story.content },
    });
  }
  return rendered;
}

describe("the seeded space rendered as a website", () => {
  it("renders every seeded block instead of dropping it", async () => {
    for (const [slug, html] of Object.entries(await renderSeedStories())) {
      expect(html, `${slug} rendered an unknown component`).not.toContain("Unknown component");
      expect(html, `${slug} rendered an unrecognized embedded value`).not.toContain(
        "Unrecognized embedded value",
      );
    }
  });

  it("covers every block in the schema across the seed stories", async () => {
    const rendered = Object.values(await renderSeedStories()).join("");
    const seen = new Set([...rendered.matchAll(/data-block="(\w+)"/g)].map((match) => match[1]));
    const expected = Object.values(schema.blocks).map((block) => block.name);

    expect([...seen].sort()).toEqual([...expected].sort());
  });

  it("renders blocks embedded in richtext, not only those in bloks fields", async () => {
    const { home: renderedHome } = await renderSeedStories();

    expect(renderedHome).toContain("Card embedded in richtext");
  });
});
