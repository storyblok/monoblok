# ADR-0012: Schema-Derived Type Generation for the CLI

**Status:** Accepted
**Date:** 2026-07-28

## Context

`storyblok types generate` built types with `json-schema-to-typescript` from pulled component JSON. It ignored field `required` flags, so every field came out looser than it actually was. It ignored `bloks` field `component_group_whitelist`s, so nested block types were never narrowed to the blocks a field actually allows. It ignored the nestable versus root distinction, so root-only and block-only components typed the same way. It also required a prior `components pull` with matching flags, an extra step that could silently drift from what was actually in the space.

`@storyblok/schema` already models all of this correctly at the type level, but only for users who define their schema in code with `defineBlock`, `defineField`, and friends. Users managing components in the Storyblok UI had no way to get those types without hand-writing them.

## Decision

`types generate --future-schema` fetches the space's components and component groups directly from the Management API and emits block definition type literals, plus the public surface a hand-written `schema.ts` would export: `Blocks`, `Schema`, `FieldPlugins`, `Block<TName>`, `AnyBlock`, `Story`, and `StoryMapi`. Content shapes are resolved by TypeScript in the user's own project through `@storyblok/schema`'s `BlockContent`, the same type that resolves them for code-defined schemas.

Every field to value rule stays in `@storyblok/schema`. The CLI duplicates none of it, so the two paths cannot drift apart. The emitted file imports `@storyblok/schema`, so it must be installed as a types-only dev dependency. `Block<'hero'>` is the user-facing surface; the definition types and `Blocks` union are plumbing for `withTypes<Schema>()` and for `Block` itself. No per-block content aliases are emitted, matching the pattern already established for code-defined schemas. The legacy generator is deprecated with a runtime warning, not removed, so existing pipelines keep working until users migrate.

## Alternatives Considered

- **Generate flattened content interfaces with the TypeScript compiler API** (write a temporary `schema init` style module, then resolve types with TypeScript's `unstable/sync` API and walk the resolved properties). Prototyped and rejected for four reasons. Self-referencing blocks collapsed to `any` under every `NodeBuilderFlags` combination tried, so correct output would still need a hand-written property walk rather than a type-printer call. A `Prettify` step destroyed `aliasSymbol`, so named types such as `AssetFieldValue` printed as their raw inlined structure instead of by name, and recovering the name required structural assignability matching against every known field-value type. The property walk itself re-implemented the field to value mapping rules in JavaScript, which would then need to track `field.ts` forever as a second copy. And the approach added `typescript` as a CLI runtime dependency, a platform-specific native binary, plus a subprocess per run and a temporary workspace written into the user's project. Its only advantage was an emitted file that does not import `@storyblok/schema`. Since `withTypes<Schema>()` forces the definition types into the file regardless, and those same types make `Block<TName>` a one-line alias, the compiler route would have produced a second, drift-prone representation of types the file already expresses.
- **Reimplement the field to value mapping in the CLI** to emit fully self-contained interfaces without a compiler or a `@storyblok/schema` import. Rejected for the same duplication reason as above, with no compensating benefit: it trades one import for a second implementation of rules that must stay in lockstep with `field.ts`.

## Consequences

- Types generated from a space's live schema are as accurate as types written by hand with `defineBlock`, because both paths resolve through the same `BlockContent` logic in `@storyblok/schema`.
- Consumers of `--future-schema` must add `@storyblok/schema` as a dev dependency. It is a types-only import and is never included in application bundles.
- The generated file is generated code and should be excluded from the user's linter and formatter, the same way any other codegen output is.
- The legacy generator remains available and unchanged, so no existing workflow breaks, but it now prints a deprecation warning pointing at `--future-schema`.
