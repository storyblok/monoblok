import type { StoryblokPropertyType } from "../types/storyblok";

// Runtime companion to the StoryblokPropertyType union: the field types that
// `types generate` maps onto a hand-written `Storyblok*` type in src/types/storyblok.ts
// instead of deriving a shape from the component schema.
//
// Keyed by the union rather than listed in an array so tsc rejects both a missing and an
// unknown member: adding a type to the union without listing it here fails to compile.
// The shapes themselves live in src/types/storyblok.ts and must not be restated here.
const STORYBLOK_PROPERTY_TYPES: Record<StoryblokPropertyType, true> = {
  asset: true,
  multiasset: true,
  multilink: true,
  richtext: true,
  table: true,
};

// Accepts `unknown` because callers pass a JSON Schema `type`, which may also be an array of
// type names. That is never a Storyblok field type, so it narrows away here rather than
// being cast away at the call site.
export const isStoryblokPropertyType = (type: unknown): type is StoryblokPropertyType =>
  typeof type === "string" && Object.hasOwn(STORYBLOK_PROPERTY_TYPES, type);
