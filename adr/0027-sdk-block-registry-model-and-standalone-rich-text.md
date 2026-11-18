# ADR-0027: SDK Block Registry Model and Standalone Rich Text

**Status:** Proposed **Date:** 2026-11-18

## Context

Every framework SDK has to answer the same questions: how a block's `component` name maps to a
framework component, what that component receives, what happens when nothing matches, and how rich
text renders embedded bloks. The previous SDKs answered with a global `storyblokInit` singleton and
an untyped `blok` prop. On a server that shares module state across requests, that means one
registry per process, shared between requests, and no check that components match the props they're
given.

The redesigned SDKs replace this with scoped block registries created by `defineStoryblokBlocks()`.
The model should be the same in every SDK that adopts it, so docs, fixes and mental models carry
over, and so Vue, Nuxt and Angular have a norm to follow instead of inventing their own.

Rich text needs its own decision. If the registry result included a `StoryblokRichText` bound to it,
the renderer couldn't be tree-shaken: in Svelte that is about 5.7 of the 7.37 kB gzip entry on every
hydrated page, rich text or not. A second, unbound `StoryblokRichText` next to it would do nothing
the bound one can't, and it would silently drop embedded bloks.

## Decision

### 1. Factory

`defineStoryblokBlocks(() => ({ components, fallback, warnings }))` takes a lazy factory, not an
options object. It runs on the first render and its result is cached. Block components often import
`StoryblokBlock` back from the same module to render nested `body` fields, which is an import cycle.
Reading `components` at definition time would hit it. Each call creates an independent registry, so
an app can define several.

### 2. Registry result: `StoryblokBlock` only

The result contains `StoryblokBlock` and nothing else. `StoryblokBlock` takes a `block` (optional,
so `story?.content` can be passed) and renders the registered component, or the `fallback` for an
unregistered type. Lookup uses own properties only, so a block type such as `constructor` can't
resolve to an `Object.prototype` member.

### 3. Reserved props: `block` and `editable`

A registered component receives a typed `block` and an `editable` prop holding the Visual Editor
attributes (`storyblokEditable(block)`), to be spread on its root element. Both are reserved:
`StoryblokBlock` injects them after any other prop, so an extra prop can never replace them.

### 4. Extra props

`defineStoryblokBlocks<TExtraProps>()` declares extra props that `StoryblokBlock` forwards to every
registered component. The type parameter is the only source of `TExtraProps` (`NoInfer`), so a
component can't widen it. A registered component may require only declared props, and `TExtraProps`
can't declare `block` or `editable`.

### 5. Warnings

`warnings` defaults to `true`. Content editors can add block types the code doesn't know about, so
silent output is the wrong default. `StoryblokBlock` warns when it renders nothing:

- an unregistered block type with no `fallback`,
- a registered component or `fallback` that isn't a valid component (for example `undefined` from a
  circular import),
- an undefined `block`, except in the Visual Editor's visual history, where the bridge sends a story
  without content.

Each warning prints once per registry and key, so the Visual Editor's frequent re-renders don't
repeat it. `warnings: false` silences all of them, in any environment. In frameworks that hydrate,
warnings also reach the visitor's browser console, which the docs state.

### 6. Closures, not context

The registry binds to `StoryblokBlock` through a closure at definition time, not through a context
or provider. A closure needs no provider in the tree, works where there is no component context
(Astro server components, rich text renderers), keeps registries independent on the same page, and
has no module-level state to share between requests. Where the framework's component model needs a
primitive to carry the registry (a proxied prop in Svelte, `createComponent` in Astro), it stays an
internal detail with no public prop name.

### 7. Rich text is standalone

- Rich text is its own export, never part of the registry result and never bound to a registry. It
  is a component (`StoryblokRichText`) where the framework only allows components, as in Astro, and
  can be a function where it fits better, like React's `createRichTextRenderer`.
- Embedded bloks render only through `components.blok`. The renderer receives the node's `attrs` and
  renders `attrs.body`, usually with `StoryblokBlock`, which gives embedded bloks the app's
  registry, `editable` attributes and `fallback`.
- If the document contains a `blok` node and no `components.blok` is passed, the SDK warns once per
  environment and asks for a blok renderer. `warnings: false` silences it. A document without `blok`
  nodes never warns.

```svelte
<!-- RichTextBlok.svelte -->
<script lang="ts">
  import { StoryblokBlock } from '$lib/storyblok';
  const { attrs } = $props();
</script>

{#each attrs.body as block (block._uid)}
  <StoryblokBlock {block} />
{/each}
```

```svelte
<StoryblokRichText document={block.text} components={{ blok: RichTextBlok }} />
```

### 8. No shared core, aligned implementations

There is no shared code across the SDKs for now. Each SDK has its own registry implementation, and
they follow the same patterns and stay consistent wherever possible. Two details that have already
drifted are decided here:

- **`StoryblokBlockData` uses `unknown`, not `any`**, for the fields of a block (for example
  `Record<string, unknown>`). It is stricter, so a component has to narrow a field before using it.
  Components that know their block's shape type it with their own generic.
- **Warnings are silenced with a `withoutWarnings()` helper on the registry**, not an inline
  override at each call site. It is named, covers every warning in one place, and can be tested on
  its own.

A shared abstraction can be revisited once more SDKs have adopted the model.

## Alternatives Considered

- **Rich text on the registry result** — Works without a `components.blok` renderer, but can't be
  tree-shaken and couples rich text to the registry. Rejected.
- **A registry-bound and an unbound rich text** — Two components with overlapping behavior, where
  the unbound one drops embedded bloks without saying so. Rejected.
- **Context or provider for the registry** — Needs a provider per tree, has no equivalent in every
  framework, and can't cross a server-component boundary. Rejected for closures.
- **An options object instead of a factory** — Breaks on the import cycle between the registry and
  its block components. Rejected.
- **A shared registry core package** — Removes the drift, but adds a cross-framework abstraction
  before more than a few SDKs use the model. Rejected for now: each SDK keeps its own copy and
  follows the same patterns.
- **Warnings off by default** — Unknown block types and a missing blok renderer then lose content
  without any sign. Rejected.

## Consequences

- Every redesigned SDK exposes the same `defineStoryblokBlocks()` shape, with the same reserved
  props, warnings and `warnings: false` switch. The docs can describe it once.
- Apps that render rich text with embedded bloks write one small `components.blok` renderer. Apps
  without rich text don't bundle the renderer.
- Astro and React, which render embedded bloks through the registry today, move to this contract:
  rich text leaves the registry result, and `components.blok` becomes the way to render embedded
  bloks. Vue, Nuxt and Angular implement it from the start.
- Each SDK keeps its own registry code, so the drift between copies has to be caught in review.
  Section 8 names the details that have to match.
