import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { TRANSLATION_SEPARATOR } from "@storyblok/schema/migrations";
import { describe, expect, it } from "vitest";

import home from "../.storyblok/stories/seed/home_story-home.json";
import legacy from "../.storyblok/stories/offline/legacy_story-legacy.json";
import pricing from "../.storyblok/stories/seed/pricing_story-pricing.json";
import team from "../.storyblok/stories/seed/team_story-team.json";
import translated from "../.storyblok/stories/seed/translated_story-translated.json";
import { schema } from "../src/schema/schema";
import StoryblokComponent from "../src/components/storyblok/storyblok-component.astro";

const SEED_STORIES = { home, team, pricing, translated, legacy };

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

/** Each translation badge the page rendered, scoped to its own `<li>` element. */
function translationBadgesOf(html: string): { key: string; isGap: boolean }[] {
  return [...html.matchAll(/<li[^>]*data-translation="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map(
    (match) => ({ key: match[1], isGap: match[2].includes(">missing<") }),
  );
}

/** Every `<field>__i18n__<locale>` key in a story's content, at any depth. */
function translationKeysOf(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      translationKeysOf(entry, found);
    }
    return found;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      if (key.includes(TRANSLATION_SEPARATOR)) {
        found.add(key.replace(TRANSLATION_SEPARATOR, ":"));
      }
      translationKeysOf(nested, found);
    }
  }
  return found;
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

  it("renders every translated sibling the seed carries, so a dropped one is visible", async () => {
    const { translated: renderedTranslated } = await renderSeedStories();
    const shown = new Set(
      [...renderedTranslated.matchAll(/data-translation="([^"]+)"/g)].map((match) => match[1]),
    );

    expect([...shown].sort()).toEqual([...translationKeysOf(translated.content)].sort());
  });

  it("shows a translated value, not just the locale it exists for", async () => {
    const { translated: renderedTranslated } = await renderSeedStories();

    expect(renderedTranslated).toContain("Vollständig übersetzte Karte");
    expect(renderedTranslated).toContain("Une citation traduite.");
    expect(renderedTranslated).toContain("Ja, das tut sie.");
  });

  it("marks an empty translated sibling as a gap rather than rendering nothing", async () => {
    const badges = translationBadgesOf((await renderSeedStories()).translated);

    // The seed carries exactly one empty sibling, on the second card's French
    // headline. Asserting the whole set of gaps keeps this from passing on some
    // other element's gap, which a forward scan through the document would.
    expect(badges.filter((badge) => badge.isGap).map((badge) => badge.key)).toEqual([
      "headline:fr",
    ]);
    expect(badges.filter((badge) => badge.key === "headline:fr")).toEqual([
      { key: "headline:fr", isGap: false },
      { key: "headline:fr", isGap: true },
    ]);
  });
});
