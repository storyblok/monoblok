import { describe, expectTypeOf, it } from "vitest";
import type { StoryblokBlockComponentProps, StoryblokBlockProps } from "../src/types";

describe("defineStoryblokBlocks extra props typing", () => {
  it("makes a required extra prop mandatory on StoryblokBlock", () => {
    type ExtraComponentProps = { locale: string };
    type Props = StoryblokBlockProps<ExtraComponentProps>;

    // @ts-expect-error `locale` is required by `ExtraComponentProps`
    const _missingLocale: Props = { block: { component: "teaser" } };

    const _withLocale: Props = { block: { component: "teaser" }, locale: "fr" };

    expectTypeOf(_withLocale.locale).toEqualTypeOf<string>();
  });

  it("keeps an optional extra prop optional on StoryblokBlock", () => {
    type ExtraComponentProps = { locale?: string };
    type Props = StoryblokBlockProps<ExtraComponentProps>;

    const _withoutLocale: Props = { block: { component: "teaser" } };
    const _withLocale: Props = { block: { component: "teaser" }, locale: "fr" };

    expectTypeOf(_withoutLocale).toEqualTypeOf<Props>();
    expectTypeOf(_withLocale).toEqualTypeOf<Props>();
  });

  it("requires extra props on a registered component's own props too", () => {
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
});
