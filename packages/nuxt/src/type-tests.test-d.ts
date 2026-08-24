/**
 * Type-level regression guards, checked by `pnpm test:types`.
 *
 * These are compile-time only; nothing here is bundled into `dist`.
 */
import type {
  UseAsyncStoryblokOptions,
  UseAsyncStoryblokResult,
} from "./runtime/composables/useAsyncStoryblok";

/** `bridge` is optional: the composable defaults it to `{}` at runtime. */
export const bridgeIsOptional: UseAsyncStoryblokOptions = {
  api: { version: "draft" },
};

/** Passing `bridge` explicitly keeps working. */
export const bridgeIsAccepted: UseAsyncStoryblokOptions = {
  api: { version: "draft", resolve_relations: "popular-articles.articles" },
  bridge: { resolveRelations: ["popular-articles.articles"], resolveLinks: "url" },
};

/** `api` stays required. */
// @ts-expect-error -- `api` is required
export const apiIsRequired: UseAsyncStoryblokOptions = {};

/** Without a type argument, `story.content` stays `any` (backward compatible). */
export const untypedStory: UseAsyncStoryblokResult["story"] = null as any;
export const untypedContentIsAny: string = untypedStory!.value!.content;

interface HomeContent {
  title: string;
}

/** Passing a type argument flows through to `story.value.content`. */
export const typedOptions: UseAsyncStoryblokOptions<HomeContent> = {
  api: { version: "draft" },
};
export const typedStory: UseAsyncStoryblokResult<HomeContent>["story"] = null as any;
export const typedTitle: string = typedStory!.value!.content.title;
// @ts-expect-error -- `content` is `HomeContent`, which has no `nonexistent` field
export const typedTitleWrongField = typedStory!.value!.content.nonexistent;
