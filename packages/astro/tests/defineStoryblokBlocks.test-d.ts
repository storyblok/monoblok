import { describe, expectTypeOf, it } from "vitest";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import type { StoryblokBlockComponentProps, StoryblokBlockProps } from "../src/types";

// How Astro's tooling types an `.astro` import: a function of its `Props`.
declare function component<Props>(): (props: Props) => any;

describe("defineStoryblokBlocks extra props typing", () => {
  it("should make a required extra prop mandatory on StoryblokBlock", () => {
    type ExtraComponentProps = { locale: string };
    type Props = StoryblokBlockProps<ExtraComponentProps>;

    // @ts-expect-error `locale` is required by `ExtraComponentProps`
    const _missingLocale: Props = { block: { component: "teaser" } };

    const _withLocale: Props = { block: { component: "teaser" }, locale: "fr" };

    expectTypeOf(_withLocale.locale).toEqualTypeOf<string>();
  });

  it("should keep an optional extra prop optional on StoryblokBlock", () => {
    type ExtraComponentProps = { locale?: string };
    type Props = StoryblokBlockProps<ExtraComponentProps>;

    expectTypeOf<{ block: { component: string } }>().toExtend<Props>();
    expectTypeOf<{ block: { component: string }; locale: string }>().toExtend<Props>();
    expectTypeOf<Props["locale"]>().toEqualTypeOf<string | undefined>();
  });

  it("should require extra props on a registered component's own props too", () => {
    type ExtraComponentProps = { locale: string };
    type Props = StoryblokBlockComponentProps<{ headline: string }, ExtraComponentProps>;

    // @ts-expect-error `locale` is required, so `Props` without it is not assignable
    const _missingLocale: Props = { block: { component: "teaser", headline: "Teaser" } };

    const _withLocale: Props = {
      block: { component: "teaser", headline: "Teaser" },
      locale: "fr",
    };

    expectTypeOf(_withLocale.locale).toEqualTypeOf<string>();
  });

  it("should accept an undefined `block`, e.g. `story?.content`", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({}));
    const story = undefined as { content: { component: string } } | undefined;

    StoryblokBlock({ block: story?.content });
  });

  it("should reserve `block` and `editable` as extra prop names", () => {
    // @ts-expect-error `block` is injected by `StoryblokBlock`
    defineStoryblokBlocks<{ block: string }>(() => ({}));
    // @ts-expect-error `editable` is injected by `StoryblokBlock`
    defineStoryblokBlocks<{ editable: string }>(() => ({}));
  });

  it("should reject a registered component that requires an undeclared prop", () => {
    const NeedsLocale = component<StoryblokBlockComponentProps<{}, { locale: string }>>();
    const Plain = component<StoryblokBlockComponentProps<{ headline: string }>>();

    defineStoryblokBlocks(() => ({ components: { plain: Plain } }));
    defineStoryblokBlocks<{ locale: string }>(() => ({
      components: { plain: Plain, needsLocale: NeedsLocale },
      fallback: NeedsLocale,
    }));

    defineStoryblokBlocks(() => ({
      // @ts-expect-error `locale` isn't declared via `defineStoryblokBlocks<TExtraProps>()`
      components: { needsLocale: NeedsLocale },
    }));
    // @ts-expect-error `locale` isn't declared via `defineStoryblokBlocks<TExtraProps>()`
    defineStoryblokBlocks(() => ({ fallback: NeedsLocale }));
  });

  it("should return a `StoryblokRichText` that accepts `warnings`", () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({}));

    StoryblokRichText({ document: null, warnings: false, data: { locale: "fr" } });
  });
});
