// Type-level tests, checked by `svelte-check` (`pnpm check`), not run by Vitest.
import { defineStoryblokBlocks } from "../../lib/define-storyblok-blocks";
import type { StoryblokBlockComponentProps, StoryblokBlockData } from "../../lib/types";
import BlokTypo from "../blocks/BlokTypo.svelte";
import Fallback from "../blocks/Fallback.svelte";
import RequiresLocale from "../blocks/RequiresLocale.svelte";
import Teaser from "../blocks/Teaser.svelte";

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
