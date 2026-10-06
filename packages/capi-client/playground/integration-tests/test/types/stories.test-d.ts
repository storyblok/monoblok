import { describe, expectTypeOf, it } from "vitest";
import {
  type BlockContent,
  defineBlock,
  defineField,
  defineSchema,
  type Schema as InferSchema,
  type PluginFieldValue,
} from "@storyblok/schema";
import { storyblokColorField } from "@storyblok/schema/field-plugins";

import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { createApiClient, type Story, type WithInlinedRelations } from "@storyblok/api-client";

// Nestable block — not a root story type
const _teaserComponent = defineBlock({
  name: "teaser",
  fields: [
    defineField("text", { type: "text", required: true }),
    defineField("image", { type: "asset" }),
  ],
  id: 0,
  created_at: "",
  updated_at: "",
});
// Root content type that is also nestable (can appear as both a story and inside bloks)
const _heroComponent = defineBlock({
  name: "hero",
  is_root: true,
  fields: [
    defineField("title", { type: "text", required: true }),
    defineField("count", { type: "number", required: true }),
    // bloks field without a whitelist — resolves to nestable components only
    defineField("sections", { type: "bloks", required: true }),
  ],
  id: 0,
  created_at: "",
  updated_at: "",
});
// Root content type, not nestable
const _pageComponent = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("headline", { type: "text", required: true }),
    defineField("body", { type: "richtext" }),
    defineField("teasers", { type: "bloks", allow: ["teaser"], required: true }),
    defineField("hero", { type: "bloks", allow: ["hero"], required: true }),
    defineField("blocks", { type: "bloks", allow: ["hero", "teaser"], required: true }),
  ],
  id: 0,
  created_at: "",
  updated_at: "",
});

interface StoryblokTypes {
  components: typeof _pageComponent | typeof _heroComponent | typeof _teaserComponent;
}

describe("createApiClient without .withTypes()", () => {
  it("should return Story from stories.get()", async () => {
    const client = createApiClient({ accessToken: "test-token" });
    const result = await client.stories.get("home");
    if (result.data) {
      expectTypeOf(result.data.story).toEqualTypeOf<Story>();
    }
  });

  it("should return Story array from stories.list()", async () => {
    const client = createApiClient({ accessToken: "test-token" });
    const result = await client.stories.list();
    if (result.data) {
      expectTypeOf(result.data.stories).toEqualTypeOf<Story[]>();
    }
  });

  it("should infer ThrowOnError from config without .withTypes()", async () => {
    const client = createApiClient({ accessToken: "test-token", throwOnError: true });
    const result = await client.stories.get("home");
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    expectTypeOf(result.data.story).toEqualTypeOf<Story>();
  });

  it("should allow per-call throwOnError override to false", async () => {
    const client = createApiClient({ accessToken: "test-token", throwOnError: true });
    const result = await client.stories.get("home", { throwOnError: false });
    expectTypeOf(result.data).toMatchTypeOf<{ story: Story } | undefined>();
  });
});

describe("createApiClient with .withTypes()", () => {
  it("should narrow page content fields after component discriminant check", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "page") {
        expectTypeOf(story.content.headline).toEqualTypeOf<string>();
        expectTypeOf(story.content.component).toEqualTypeOf<"page">();
      }
    }
  });

  it("should narrow hero content fields after component discriminant check", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "hero") {
        expectTypeOf(story.content.title).toEqualTypeOf<string>();
        expectTypeOf(story.content.count).toEqualTypeOf<string>();
        expectTypeOf(story.content.component).toEqualTypeOf<"hero">();
      }
    }
  });

  it("should have union of root component names on content", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      // Only root components (is_root: true) appear in story content
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<"page" | "hero">();
      if (result.data.story.content.component === "hero") {
        expectTypeOf(result.data.story.content.title).toEqualTypeOf<string>();
      }
    }
  });

  it("should narrow discriminated union in stories.list()", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.list();
    if (result.data) {
      for (const story of result.data.stories) {
        if (story.content.component === "page") {
          expectTypeOf(story.content.headline).toEqualTypeOf<string>();
        }
        if (story.content.component === "hero") {
          expectTypeOf(story.content.count).toEqualTypeOf<string>();
        }
      }
    }
  });

  it("should narrow bloks field on page to whitelisted component names", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "page") {
        for (const teaser of story.content.teasers) {
          expectTypeOf(teaser.component).toEqualTypeOf<"teaser">();
          expectTypeOf(teaser.text).toEqualTypeOf<string>();
        }
        for (const hero of story.content.hero) {
          expectTypeOf(hero.component).toEqualTypeOf<"hero">();
          expectTypeOf(hero.count).toEqualTypeOf<string>();
        }
        for (const blok of story.content.blocks) {
          expectTypeOf(blok.component).toEqualTypeOf<"hero" | "teaser">();
        }
      }
    }
  });

  it("should fall back to nestable-only components for bloks field without whitelist", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "hero") {
        // sections has no component_whitelist — falls back to nestable (is_nestable: true) components only
        // page has is_nestable: false, so it is excluded; hero and teaser default to is_nestable: true
        type HeroContent = typeof story.content;
        type Sections = HeroContent["sections"];
        expectTypeOf<Sections[number]["component"]>().toEqualTypeOf<"hero" | "teaser">();
      }
    }
  });

  it("should infer ThrowOnError alongside .withTypes()", async () => {
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
    }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    // ThrowOnError=true means data is always defined (no optional chaining needed)
    // Only root components (page, hero) appear in story content
    expectTypeOf(result.data.story.content.component).toEqualTypeOf<"page" | "hero">();
  });

  it("should allow per-call throwOnError override to false alongside .withTypes()", async () => {
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
    }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home", { throwOnError: false });
    expectTypeOf(result.data).toMatchTypeOf<
      { story: { content: { component: "page" | "hero" } } } | undefined
    >();
  });

  it("should return schema-typed stories when inlineRelations is true", async () => {
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      // Schema types are returned even with inlineRelations — the best static approximation
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<"page" | "hero">();
      if (result.data.story.content.component === "page") {
        expectTypeOf(result.data.story.content.headline).toEqualTypeOf<string>();
      }
    }
  });
});

describe("createApiClient with .withTypes() — negative type tests", () => {
  it("should not allow accessing a field from a different component without narrowing", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      // Without narrowing by component, hero-specific field `count` should not be accessible
      // @ts-expect-error: count does not exist on the union without narrowing to hero
      void result.data.story.content.count;
    }
  });

  it("should not allow accessing non-existent field after narrowing", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    const result = await client.stories.get("home");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "page") {
        // @ts-expect-error: `nonExistent` is not a field on the page component
        void story.content.nonExistent;
      }
    }
  });
});

describe("resolve_relations type narrowing", () => {
  // Both are root content types — they have their own story pages in Storyblok
  // and can be referenced via resolve_relations
  const _authorComponent = defineBlock({
    name: "author",
    is_root: true,
    fields: [defineField("bio", { type: "text", required: true })],
  });
  const _articleComponent = defineBlock({
    name: "article",
    is_root: true,
    fields: [
      defineField("title", { type: "text", required: true }),
      // In Storyblok, this would be an option field with source: internal_stories.
      // At the schema level it's just a text/option field (string).
      // resolve_relations is what tells the client to inline it.
      defineField("author", { type: "option", required: true }),
      defineField("category", { type: "option", required: true }),
    ],
  });

  interface RelationStoryblokTypes {
    components: typeof _authorComponent | typeof _articleComponent;
  }

  const createClient = () =>
    createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    }).withTypes<RelationStoryblokTypes>();

  it("should type resolved relation fields as story objects in get()", async () => {
    const result = await createClient().stories.get("my-article", {
      query: { resolve_relations: "article.author" },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "article") {
        expectTypeOf(story.content.author)
          .exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "article">();
        expectTypeOf(story.content.category).toBeString();
      }
    }
  });

  it("should keep an unresolved relation a UUID string", async () => {
    const result = await createClient().stories.get("my-article", {
      query: { resolve_relations: "article.author" },
    });
    if (result.data && result.data.story.content.component === "article") {
      expectTypeOf(result.data.story.content.author).extract<string>().toEqualTypeOf<string>();
    }
  });

  it("should type multiple resolved fields in get()", async () => {
    const result = await createClient().stories.get("my-article", {
      query: { resolve_relations: "article.author,article.category" },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "article") {
        expectTypeOf(story.content.author)
          .exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "article">();
        expectTypeOf(story.content.category)
          .exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "article">();
        expectTypeOf(story.content.title).toBeString();
      }
    }
  });

  it("should type resolved relation fields as story objects in list()", async () => {
    const result = await createClient().stories.list({
      query: { resolve_relations: "article.author" },
    });
    if (result.data) {
      for (const story of result.data.stories) {
        if (story.content.component === "article") {
          expectTypeOf(story.content.author)
            .exclude<string>()
            .toHaveProperty("content")
            .toHaveProperty("component")
            .toEqualTypeOf<"author" | "article">();
          expectTypeOf(story.content.category).toBeString();
        }
      }
    }
  });

  it("should keep original schema types when no resolve_relations is provided", async () => {
    const result = await createClient().stories.get("my-article");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "article") {
        expectTypeOf(story.content.author).toBeString();
        expectTypeOf(story.content.category).toBeString();
      }
    }
  });

  it("should allow narrowing resolved relation content by component", async () => {
    const result = await createClient().stories.get("my-article", {
      query: { resolve_relations: "article.author" },
    });
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "article") {
        const author = story.content.author;
        // A related story can be any root block, so narrow by component
        if (typeof author !== "string" && author.content.component === "author") {
          expectTypeOf(author.content.bio).toBeString();
        }
      }
    }
  });
});

describe("resolve_relations typing with inlineRelations", () => {
  const _authorComponent = defineBlock({
    name: "author",
    is_root: true,
    is_nestable: false,
    fields: [
      defineField("bio", { type: "text", required: true }),
      defineField("mentor", { type: "option" }),
    ],
  });
  const _featuredArticlesComponent = defineBlock({
    name: "featured-articles",
    is_root: false,
    is_nestable: true,
    fields: [
      defineField("posts", { type: "options", required: true }),
      defineField("highlight", { type: "option" }),
      defineField("tags", { type: "options", required: true }),
    ],
  });
  const _sectionComponent = defineBlock({
    name: "section",
    is_root: false,
    is_nestable: true,
    fields: [defineField("items", { type: "bloks", allow: ["featured-articles"], required: true })],
  });
  const _landingComponent = defineBlock({
    name: "landing",
    is_root: true,
    is_nestable: false,
    fields: [
      defineField("title", { type: "text", required: true }),
      defineField("authors", { type: "options", required: true }),
      defineField("body", { type: "bloks", allow: ["featured-articles"], required: true }),
      defineField("sections", { type: "bloks", allow: ["section"], required: true }),
      defineField("text", { type: "richtext", allow: ["featured-articles"] }),
      defineField("notes", { type: "richtext" }),
    ],
  });

  type Components =
    | typeof _authorComponent
    | typeof _featuredArticlesComponent
    | typeof _sectionComponent
    | typeof _landingComponent;

  interface NestedRelationTypes {
    components: Components;
  }

  const RELATIONS = "featured-articles.posts,featured-articles.highlight,landing.authors";

  const createClient = () =>
    createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    }).withTypes<NestedRelationTypes>();

  it("should type a relation field of a block nested in a root block as the related story", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const block = result.data.story.content.body[0];
      if (block) {
        expectTypeOf(block.posts).toBeArray();
        expectTypeOf(block.posts)
          .items.exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "landing">();
        expectTypeOf(block.tags).toEqualTypeOf<string[]>();
      }
    }
  });

  it("should type a relation field of a doubly nested block as the related story", async () => {
    const result = await createClient().stories.list({
      query: { resolve_relations: RELATIONS },
    });
    const story = result.data?.stories[0];
    if (story && story.content.component === "landing") {
      const block = story.content.sections[0]?.items[0];
      if (block) {
        expectTypeOf(block.posts)
          .items.exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "landing">();
      }
    }
  });

  it("should type a relation field of a block embedded in richtext as the related story", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const node = result.data.story.content.text?.content[0];
      if (node && node.type === "blok") {
        const block = node.attrs.body?.[0];
        if (block) {
          expectTypeOf(block.posts)
            .items.exclude<string>()
            .toHaveProperty("content")
            .toHaveProperty("component")
            .toEqualTypeOf<"author" | "landing">();
        }
      }
    }
  });

  it("should type relations inside a related story's content", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: "landing.authors,author.mentor" },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const author = result.data.story.content.authors[0];
      if (author && typeof author !== "string" && author.content.component === "author") {
        expectTypeOf(author.content.mentor).exclude<string>().toBeNullable();
        expectTypeOf(author.content.mentor)
          .exclude<string | null | undefined>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "landing">();
      }
    }
  });

  it("should inline relations below a listed bloks field", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: "landing.body,featured-articles.posts" },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const block = result.data.story.content.body[0];
      if (block) {
        expectTypeOf(block.posts)
          .items.exclude<string>()
          .toHaveProperty("content")
          .toHaveProperty("component")
          .toEqualTypeOf<"author" | "landing">();
      }
    }
  });

  it("should keep a multi-option relation an array and a single-option relation optional", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const content = result.data.story.content;
      expectTypeOf(content.authors).toBeArray();
      expectTypeOf(content.authors)
        .items.exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
      const highlight = content.body[0]?.highlight;
      expectTypeOf(highlight).toBeNullable();
      expectTypeOf(highlight)
        .exclude<string | null | undefined>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
    }
  });

  it("should type a related story's content as a root block only", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const author = result.data.story.content.authors[0];
      if (author && typeof author !== "string") {
        expectTypeOf(author.content.component).toEqualTypeOf<"author" | "landing">();
      }
    }
  });

  it("should trim whitespace around relation paths", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: "landing.title, \n\t\u00A0landing.authors" },
    });
    if (result.data && result.data.story.content.component === "landing") {
      expectTypeOf(result.data.story.content.authors)
        .items.exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
    }
  });

  it("should type every string field except component, _uid and _editable as a possible story for a non-literal resolve_relations", async () => {
    const query: { resolve_relations: string } = { resolve_relations: RELATIONS };
    const result = await createClient().stories.get("landing", { query });
    const content = result.data?.story.content;
    if (content && content.component === "landing") {
      expectTypeOf(content._uid).toEqualTypeOf<string>();
      expectTypeOf(content._editable).toEqualTypeOf<string | undefined>();
      expectTypeOf(content.title).extract<string>().toEqualTypeOf<string>();
      expectTypeOf(content.title)
        .exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
      expectTypeOf(content.body)
        .items.toHaveProperty("component")
        .toEqualTypeOf<"featured-articles">();
      expectTypeOf(content.body)
        .items.toHaveProperty("tags")
        .items.exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
    }
  });

  it("should type a relation field of a block embedded in richtext without allow as a possible story", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const node = result.data.story.content.notes?.content[0];
      if (node && node.type === "blok") {
        const block = node.attrs.body?.[0];
        if (block) {
          expectTypeOf(block._editable).toEqualTypeOf<string | undefined>();
          expectTypeOf(block["posts"])
            .extract<{ full_slug: string }>()
            .toHaveProperty("content")
            .toHaveProperty("component")
            .toEqualTypeOf<"author" | "landing">();
        }
      }
    }
  });

  it("should keep richtext types when no relation path can reach an embedded block", async () => {
    type PlainLanding = BlockContent<typeof _landingComponent, Components>;
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: "landing.authors" },
    });
    if (result.data && result.data.story.content.component === "landing") {
      expectTypeOf(result.data.story.content.notes).toEqualTypeOf<PlainLanding["notes"]>();
      expectTypeOf(result.data.story.content.text).toEqualTypeOf<PlainLanding["text"]>();
    }
  });

  it("should accept inlined richtext as richtext renderer input", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      expectTypeOf(result.data.story.content.notes).toExtend<StoryblokRichTextInput>();
      expectTypeOf(result.data.story.content.text).toExtend<StoryblokRichTextInput>();
    }
  });

  it("should split a URL-encoded resolve_relations like the runtime", async () => {
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: "landing.title%2Clanding.authors" },
    });
    if (result.data && result.data.story.content.component === "landing") {
      expectTypeOf(result.data.story.content.authors)
        .items.exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
    }
  });

  it("should type a resolve_relations with 60 paths", async () => {
    const result = await createClient().stories.get("landing", {
      query: {
        resolve_relations:
          "landing.authors,b1.f,b2.f,b3.f,b4.f,b5.f,b6.f,b7.f,b8.f,b9.f,b10.f,b11.f,b12.f,b13.f,b14.f,b15.f,b16.f,b17.f,b18.f,b19.f,b20.f,b21.f,b22.f,b23.f,b24.f,b25.f,b26.f,b27.f,b28.f,b29.f,b30.f,b31.f,b32.f,b33.f,b34.f,b35.f,b36.f,b37.f,b38.f,b39.f,b40.f,b41.f,b42.f,b43.f,b44.f,b45.f,b46.f,b47.f,b48.f,b49.f,b50.f,b51.f,b52.f,b53.f,b54.f,b55.f,b56.f,b57.f,b58.f,b59.f",
      },
    });
    if (result.data && result.data.story.content.component === "landing") {
      expectTypeOf(result.data.story.content.authors)
        .items.exclude<string>()
        .toHaveProperty("content")
        .toHaveProperty("component")
        .toEqualTypeOf<"author" | "landing">();
    }
  });

  it("should keep relations as UUIDs without inlineRelations", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<NestedRelationTypes>();
    const result = await client.stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const content = result.data.story.content;
      expectTypeOf(content.authors).toEqualTypeOf<string[]>();
      expectTypeOf(content.body).items.toHaveProperty("posts").toEqualTypeOf<string[]>();
    }
  });

  it("should type component props with WithInlinedRelations", () => {
    type Props = WithInlinedRelations<
      typeof _featuredArticlesComponent,
      "featured-articles.posts",
      Components
    >;
    type RelatedStory = Exclude<Props["posts"][number], string>;

    expectTypeOf<Props["component"]>().toEqualTypeOf<"featured-articles">();
    expectTypeOf<RelatedStory["content"]["component"]>().toEqualTypeOf<"author" | "landing">();
    expectTypeOf<Props["tags"]>().toEqualTypeOf<string[]>();
  });

  it("should accept a fetched block as props declared with the same relation paths", async () => {
    type Props = WithInlinedRelations<
      typeof _featuredArticlesComponent,
      typeof RELATIONS,
      Components
    >;
    const result = await createClient().stories.get("landing", {
      query: { resolve_relations: RELATIONS },
    });
    if (result.data && result.data.story.content.component === "landing") {
      const block = result.data.story.content.body[0];
      if (block) {
        expectTypeOf(block).toExtend<Props>();
      }
    }
  });
});

describe("defineBlock result from mapi shape used in capi withTypes", () => {
  // Simulate the full workflow: components are defined once and shared between
  // mapi (for write operations) and capi (for read operations).
  // These components mirror what you would receive from mapi.components.get() and
  // then pass to defineBlock() to enrich with types.

  const _productComponent = defineBlock({
    name: "product",
    is_root: true,
    is_nestable: false,
    // Simulating fields that would come from a mapi.components.get() response
    id: 42,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    fields: [
      defineField("title", { type: "text", required: true }),
      defineField("price", { type: "number", required: true }),
      defineField("tags", { type: "options", required: true }),
      defineField("description", { type: "richtext" }),
    ],
  });

  const _featureComponent = defineBlock({
    name: "feature",
    is_nestable: true,
    id: 43,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    fields: [defineField("label", { type: "text", required: true })],
  });

  interface ProductTypes {
    components: typeof _productComponent | typeof _featureComponent;
  }

  it("mapi-shaped defineBlock result should narrow capi story content", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<ProductTypes>();
    const result = await client.stories.get("product-slug");
    if (result.data) {
      // Only product (is_root: true) appears as story content; feature is nestable-only
      expectTypeOf(result.data.story.content.component).toEqualTypeOf<"product">();
    }
  });

  it("mapi-shaped defineBlock with required fields should have correct capi field types", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<ProductTypes>();
    const result = await client.stories.get("product-slug");
    if (result.data) {
      const story = result.data.story;
      if (story.content.component === "product") {
        // required: true → no null/undefined in capi
        expectTypeOf(story.content.title).toEqualTypeOf<string>();
        expectTypeOf(story.content.price).toEqualTypeOf<string>();
      }
    }
  });

  it("capi stories.list with mapi-shaped components should type each story", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<ProductTypes>();
    const result = await client.stories.list();
    if (result.data) {
      for (const story of result.data.stories) {
        // product is the only root component
        expectTypeOf(story.content.component).toEqualTypeOf<"product">();
      }
    }
  });
});

describe("createApiClient with .withTypes() — field plugins", () => {
  const _themedComponent = defineBlock({
    name: "themed",
    is_root: true,
    fields: [
      defineField("bg", { type: "custom", field_type: "storyblok-colorpicker" }),
      defineField("legacy", { type: "custom", field_type: "unregistered-plugin" }),
    ],
  });
  const _schema = defineSchema({
    blocks: { themedComponent: _themedComponent },
    fieldPlugins: { storyblokColorField },
  });
  type Schema = InferSchema<typeof _schema>;

  it("resolves a registered custom field to the validator output merged with the plugin envelope", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<Schema>();
    const result = await client.stories.get("home");
    if (result.data && result.data.story.content.component === "themed") {
      expectTypeOf<NonNullable<typeof result.data.story.content.bg>>().toEqualTypeOf<{
        color: string;
        plugin: string;
        _uid?: string;
      }>();
    }
  });

  it("leaves an unregistered custom field as PluginFieldValue", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<Schema>();
    const result = await client.stories.get("home");
    if (result.data && result.data.story.content.component === "themed") {
      expectTypeOf<
        NonNullable<typeof result.data.story.content.legacy>
      >().toEqualTypeOf<PluginFieldValue>();
    }
  });
});

describe("stories pagination", () => {
  it("should yield Story from stories.iterate()", async () => {
    const client = createApiClient({ accessToken: "test-token" });
    for await (const story of client.stories.iterate()) {
      expectTypeOf(story).toEqualTypeOf<Story>();
    }
  });

  it("should yield narrowed stories from stories.iterate() with .withTypes()", async () => {
    const client = createApiClient({ accessToken: "test-token" }).withTypes<StoryblokTypes>();
    for await (const story of client.stories.iterate()) {
      expectTypeOf(story.content.component).toEqualTypeOf<"page" | "hero">();
    }
  });

  it("should reject resolve_links and, without inlineRelations, resolve_relations in stories.iterate()", () => {
    const client = createApiClient({ accessToken: "test-token" });
    // @ts-expect-error: resolved links live in each page's `links`, which only pages() exposes
    client.stories.iterate({ query: { resolve_links: "url" } });
    // @ts-expect-error: resolved relations live in each page's `rels`, which only pages() exposes
    client.stories.iterate({ query: { resolve_relations: "page.author" } });
    client.stories.pages({ query: { resolve_links: "url", resolve_relations: "page.author" } });
  });

  it("should accept resolve_relations in stories.iterate() with inlineRelations", () => {
    const client = createApiClient({ accessToken: "test-token", inlineRelations: true });
    client.stories.iterate({ query: { resolve_relations: "page.author" } });
  });

  it("should yield envelopes with optional data from stories.pages()", async () => {
    const client = createApiClient({ accessToken: "test-token" });
    for await (const page of client.stories.pages()) {
      expectTypeOf(page.page).toEqualTypeOf<number>();
      expectTypeOf(page.total).toEqualTypeOf<number | undefined>();
      expectTypeOf(page.data?.stories).toEqualTypeOf<Story[] | undefined>();
    }
  });

  it("should yield envelopes with defined data from stories.pages() with throwOnError", async () => {
    const client = createApiClient({ accessToken: "test-token", throwOnError: true });
    for await (const page of client.stories.pages()) {
      expectTypeOf(page.data.stories).toEqualTypeOf<Story[]>();
    }
  });
});
