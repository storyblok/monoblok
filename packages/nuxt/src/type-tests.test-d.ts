/**
 * Type-level regression guards, checked by `pnpm test:types`.
 *
 * These are compile-time only; nothing here is bundled into `dist`.
 */
import type { UseAsyncStoryblokOptions } from "./runtime/composables/useAsyncStoryblok";

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
