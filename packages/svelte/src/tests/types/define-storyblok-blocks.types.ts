// Type-level tests, checked by `svelte-check` (`pnpm check`), not run by Vitest.
import { defineStoryblokBlocks } from "../../lib/define-storyblok-blocks";
import type { StoryblokRichTextComponentProps } from "../../lib/richtext-helpers";
import type { StoryblokBlockComponentProps, StoryblokBlockData } from "../../lib/types";
import BlokTypo from "../blocks/BlokTypo.svelte";
import Fallback from "../blocks/Fallback.svelte";
import RequiresEditable from "../blocks/RequiresEditable.svelte";
import RequiresLocale from "../blocks/RequiresLocale.svelte";
import Teaser from "../blocks/Teaser.svelte";
import Heading from "../richtext/Heading.svelte";
import LocalizedBlok from "../richtext/LocalizedBlok.svelte";

// A component typed with the pre-v8 `blok` prop is rejected.
defineStoryblokBlocks(() => ({
  // @ts-expect-error `blok` is never passed by `StoryblokBlock`.
  components: { typo: BlokTypo },
}));

defineStoryblokBlocks(() => ({
  components: { teaser: Teaser },
  // @ts-expect-error `blok` is never passed by `StoryblokBlock`.
  fallback: BlokTypo,
}));

// A component requiring an extra prop the registry doesn't declare is rejected.
defineStoryblokBlocks(() => ({
  // @ts-expect-error `locale` is not declared in `TExtraProps`.
  components: { localized: RequiresLocale },
}));

// ...and accepted when the registry declares it.
defineStoryblokBlocks<{ locale: string }>(() => ({
  components: { localized: RequiresLocale },
  fallback: Fallback,
}));

// `StoryblokBlock` always passes `editable`, so a component may require it.
defineStoryblokBlocks(() => ({
  components: { editable: RequiresEditable },
}));

// `block` and `editable` are injected by `StoryblokBlock` and can't be extra props.
// @ts-expect-error `block` is reserved.
defineStoryblokBlocks<{ block: string }>(() => ({ components: {} }));
// @ts-expect-error `editable` is reserved.
defineStoryblokBlocks<{ editable: string }>(() => ({ components: {} }));

// Bare `StoryblokBlockComponentProps` and `StoryblokBlockData` agree on the
// field type: unknown fields need a type argument instead of becoming `any`.
declare const bareProps: StoryblokBlockComponentProps;
declare const bareData: StoryblokBlockData;
// @ts-expect-error `headline` is `unknown` without a type argument.
bareProps.block.headline.toUpperCase();
// @ts-expect-error `headline` is `unknown` without a type argument.
bareData.headline.toUpperCase();

declare const typedProps: StoryblokBlockComponentProps<{ headline: string }>;
typedProps.block.headline.toUpperCase();

// `StoryblokRichText` props: partial image options are accepted, unknown props aren't.
const richTextProps = {
  document: { type: "doc", content: [] },
  optimizeImage: { width: 800 },
} satisfies StoryblokRichTextComponentProps;

export const typoProps: StoryblokRichTextComponentProps = {
  document: richTextProps.document,
  // @ts-expect-error `optimiseImage` is not a `StoryblokRichText` prop.
  optimiseImage: true,
};

// `StoryblokRichText` infers `TData` from its props the same way this does.
function richText<TData = unknown>(props: StoryblokRichTextComponentProps<TData>): void {
  void props;
}
const doc: StoryblokRichTextComponentProps["document"] = { type: "doc", content: [] };

// `data` matching the type the `blok` renderer declares is accepted, next to
// components that don't read `data`.
richText({
  document: doc,
  components: { blok: LocalizedBlok, heading: Heading },
  data: { locale: "fr" },
});

// Without data-typed components, `data` stays optional and untyped.
richText({ document: doc, components: { heading: Heading } });
richText({ document: doc, data: { anything: true } });

// `data` of the wrong shape is rejected.
// @ts-expect-error `locale` must be a string.
richText({ document: doc, components: { blok: LocalizedBlok }, data: { locale: 1 } });
// @ts-expect-error `lang` is not part of the declared data.
richText({ document: doc, components: { blok: LocalizedBlok }, data: { lang: "fr" } });

// `data` is required once a component declares it.
// @ts-expect-error `data` is missing.
richText({ document: doc, components: { blok: LocalizedBlok } });

// A component is checked against the props of its key.
// @ts-expect-error a `blok` renderer isn't a `heading` renderer.
richText({ document: doc, components: { heading: LocalizedBlok }, data: { locale: "fr" } });
