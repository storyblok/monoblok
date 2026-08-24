# Handover — `@storyblok/react` v8 New API

**Branch:** `feat/react-sdk-v2`  
**Package root:** `packages/react/`  
**Date of last session:** 2026-08-24

---

## 1. Current state — implementation complete

The v8 API is fully implemented and all old v7 code has been deleted. The package builds cleanly, 92
unit tests pass, typecheck is clean, and lint reports 0 warnings.

**What was done across sessions:**

1. Designed and implemented the new two-entry API (`@storyblok/react` + `@storyblok/react/client`)
2. Executed the full cleanup — deleted all v7 source files, old entries, and obsolete tests
3. Reorganised richtext internals: `core/` → `richtext/`, all files renamed for clarity
4. Dropped `@storyblok/js` entirely — replaced `SbBlokData` with `BlockContent` from
   `@storyblok/live-preview`, and `storyblokEditable` sourced from the same package
5. Standardised terminology: all internal `blok`/`Blok` occurrences renamed to `block`/`Block`
   (brand name `Storyblok` untouched throughout)
6. Updated all deprecated type aliases in tests: `SbReactRichTextProps` →
   `StoryblokReactRichTextProps`, `SbReactRichTextComponentMap` →
   `StoryblokReactRichTextComponentMap`

---

## 2. API design

### Philosophy

| Old (v7)                                                                          | New (v8)                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `storyblokInit({ accessToken, use: [apiPlugin], components })` — global singleton | `createRegistry(…)` — explicit factory, no globals                                       |
| `StoryblokComponent` exported from the package (singleton)                        | `StoryblokComponent` returned by `createRegistry` (registry-scoped)                      |
| `useStoryblok(slug)` — fetch + bridge in one hook                                 | Fetch is the user's concern; `useStoryblokState(story)` handles the bridge only          |
| `StoryblokStory` + `liveEditUpdateAction` (opaque RSC + `globalThis` cache)       | `StoryblokPreviewRsc` + user-supplied Server Action + `React.use()` + Suspense streaming |
| `@storyblok/react` / `/ssr` / `/rsc`                                              | `@storyblok/react` (main) + `@storyblok/react/client`                                    |
| `SbBlokData` from `@storyblok/js`                                                 | `BlockContent` from `@storyblok/live-preview`                                            |
| `blok` prop convention                                                            | `block` prop convention                                                                  |

### Entry points

```
@storyblok/react        → createRegistry, createRichTextRenderer, storyblokEditable, types
@storyblok/react/client → StoryblokPreview, StoryblokPreviewRsc, useStoryblokState
```

### Canonical usage pattern

```tsx
// app/lib/storyblok.ts
import { createRegistry } from "@storyblok/react";
import { createApiClient } from "@storyblok/api-client";

export const isPreview = process.env.STORYBLOK_ENV === "preview";

export const client = createApiClient({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_DELIVERY_API_TOKEN!,
  region: process.env.NEXT_PUBLIC_STORYBLOK_REGION as "us" | "eu",
  ...(isPreview && { cache: { strategy: "network-first" } }),
});

export const { StoryblokComponent, StoryblokBlocks, StoryblokRichText } = createRegistry({
  components: {
    page: Page,
    teaser: Teaser,
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true, // auto Suspense boundary + skeleton
    },
  },
  fallback: FallbackBlock, // shown for unregistered block types
});
```

```tsx
// RSC page — live preview
import { StoryblokPreviewRsc } from "@storyblok/react/client";

const { data } = await client.stories.get(slug, { query: { version: "draft" } });
return <StoryblokPreviewRsc renderContent={renderContent}>{content}</StoryblokPreviewRsc>;
```

```tsx
// CSR / SPA — live preview
"use client";
import { useStoryblokState } from "@storyblok/react/client";

function Page({ story }) {
  const live = useStoryblokState(story);
  return <StoryblokComponent block={live.content} />;
}
```

---

## 3. Final source structure

```
packages/react/src/
├── index.ts                           ← main entry
├── create-registry.tsx                ← createRegistry factory
├── client/
│   ├── index.ts                       ← client entry barrel
│   ├── StoryblokPreview.tsx           ← CSR render-prop live preview
│   ├── StoryblokPreviewRsc.tsx        ← RSC streaming live preview
│   └── use-storyblok-state.ts        ← bridge subscription hook
└── richtext/
    ├── renderer.tsx                   ← createRichTextRenderer + all render logic
    ├── create-storyblok-richtext.tsx  ← createStoryblokRichText factory
    ├── create-default-block.tsx       ← DefaultBlock for embedded blocks in rich text
    └── types.ts                       ← richtext type barrel
```

### `src/index.ts` exports

```ts
export { createRegistry } from "./create-registry";
export { createRichTextRenderer } from "./richtext/renderer";
export { storyblokEditable } from "@storyblok/live-preview";
export type { BlockContent } from "@storyblok/live-preview";
export type { Story } from "@storyblok/api-client";
export type { ComponentEntry, RegistryOptions, RegistryResult } from "./create-registry";
export type { StoryblokRichTextRendererProps } from "./richtext/renderer";
export type { StoryblokReactRichTextComponent, StoryblokReactRichTextComponentMap,
              StoryblokReactRichTextComponentProps, StoryblokReactRichTextProps,
              StoryblokReactRichTextRenderContext, … } from "./richtext/renderer";
export type { StoryblokRichTextElement, StoryblokRichTextInput, … } from "@storyblok/richtext";
```

### `src/client/index.ts` exports

```ts
export { StoryblokPreview } from "./StoryblokPreview";
export { StoryblokPreviewRsc } from "./StoryblokPreviewRsc";
export { useStoryblokState } from "./use-storyblok-state";
```

---

## 4. Dependencies

| Package                   | Role                                                               | Type               |
| ------------------------- | ------------------------------------------------------------------ | ------------------ |
| `@storyblok/live-preview` | `storyblokEditable`, `BlockContent` type, `onStoryblokEditorEvent` | `dependencies`     |
| `@storyblok/api-client`   | `Story` type                                                       | `dependencies`     |
| `@storyblok/richtext`     | Rich text rendering internals                                      | `dependencies`     |
| `react`                   | Framework                                                          | `peerDependencies` |
| `@storyblok/js`           | **Removed entirely**                                               | —                  |

`@storyblok/js` has zero references in the package. All block data typing is via `BlockContent` from
`@storyblok/live-preview`; `storyblokEditable` is re-exported from the same package.

---

## 5. Architecture decisions

### `block` prop — not `blok`

All internal and public-facing prop names use `block` (standard English). The Storyblok brand name
is never altered: `StoryblokComponent`, `StoryblokBlocks`, `StoryblokRichText`, `storyblokEditable`
all stay as-is. Only the data prop itself is `block`, not `blok`.

### `BlockContent` replaces `SbBlokData`

`BlockContent` (unparameterised) from `@storyblok/live-preview` is strictly stronger:

- `_uid: string` — **required** (was optional in `SbBlokData`)
- `component: string` — **required** (was optional in `SbBlokData`)
- Narrower index signature (no bare `object`)
- Generic form `BlockContent<MyBlock>` narrows all fields fully via `@storyblok/schema`

### `createRegistry` returns `StoryblokRichText`

Pre-wired to the registry's own `StoryblokComponent`, so embedded blocks in rich text resolve
correctly. Avoids the v7 footgun where the standalone component silently dropped embedded blocks.

### `useStoryblokState` — kept at v7 name

Familiarity for migrating users outweighs a rename. It is the hook `StoryblokPreview` is built on;
`StoryblokPreview` is just the same hook with a render-prop shell.

### `StoryblokPreviewRsc` — no `revalidatePath`, no global cache

Replaces v7's `globalThis.storyCache` + `revalidatePath()` entirely:

- User supplies their own `renderContent` Server Action
- Component stores the returned `Promise<ReactNode>` in state
- `React.use()` inside a `<Suspense>` boundary reads the promise progressively

Critical constraint: `children` must never be stored in `useState`. Doing so forces the RSC
serialiser to fully await every async component before the initial HTML, destroying streaming.

### Two-deployment strategy

`isPreview = process.env.STORYBLOK_ENV === "preview"` evaluated at cold start. Production never sets
this variable. No per-request cookie checks, no `draftMode()`.

### No `useStoryblok` fetch hook

Removed. Users call `client` directly with `useEffect` or SWR / TanStack Query. A naive
`useEffect`+`useState` wrapper would duplicate what data-fetching libraries do better.

---

## 6. Tests

All under `src/__tests__/`:

| File                                    | Tests | Coverage                                                                                                                                                                             |
| --------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `client/create-registry.test.tsx`       | 18    | `StoryblokComponent` renders, fallback, missing prop error, Suspense, `suspenseFallback`, `StoryblokBlocks` list + fallback, `StoryblokRichText` embedded blocks, registry isolation |
| `client/use-storyblok-state.test.tsx`   | 6     | Initial story, subscribe on mount, updates on event, multiple events, unsubscribes on unmount                                                                                        |
| `client/storyblok-preview.test.tsx`     | 5     | Render prop with initial story, updates on event, re-renders, unsubscribes                                                                                                           |
| `client/storyblok-preview-rsc.test.tsx` | 7     | Children initially, `renderContent` after debounce, debounce collapses events, Suspense fallback, committed content fallback on update, cleanup on unmount                           |
| `richtext.test.tsx`                     | 56    | All richtext nodes, marks, links, tables, integration fixtures, custom components                                                                                                    |

**Key testing technique for RSC:** `vi.useFakeTimers()` + `vi.runAllTimersAsync()` inside `act()`.
`waitFor` cannot be used with fake timers because its internal `setTimeout` is also frozen.

---

## 7. Open questions

### A — `createApiClient` location

`createApiClient` is used in the canonical example and `MIGRATION.md` but is **not re-exported** by
`@storyblok/react` — users currently import it directly from `@storyblok/api-client`. Decide whether
the react package should re-export it for convenience.

### B — `StoryblokRichText` standalone export

No standalone `StoryblokRichText` is exported from the main entry. All usage flows through
`createRegistry`. If simple use cases (no embedded blocks) are common enough, a standalone export
from `createRichTextRenderer` could be added. Currently not exported.

---

## 8. Next task — update the playground

The playground(s) in `packages/react/playground/` or adjacent directories need to be updated to use
the v8 API. Key changes required in any playground app:

1. **Remove `storyblokInit`** — replace with `createRegistry` + a direct `createApiClient` call
2. **Rename `blok` props to `block`** throughout all component files
3. **Update imports** — `@storyblok/react` no longer exports `useStoryblok`, `storyblokInit`,
   `getStoryblokApi`, or `SbBlokData`; `StoryblokComponent` comes from the registry, not the package
4. **Live preview** — replace `StoryblokStory` / `liveEditUpdateAction` with `StoryblokPreviewRsc`
   or `useStoryblokState` from `@storyblok/react/client`
5. **Rich text** — get `StoryblokRichText` from the registry, not from `@storyblok/react` directly

### Files to read at the start of the next session

1. `src/create-registry.tsx` — public API and prop shapes
2. `src/client/StoryblokPreview.tsx` + `StoryblokPreviewRsc.tsx` — preview components
3. `src/client/use-storyblok-state.ts` — bridge hook
4. `src/index.ts` — full export surface of the main entry
5. `MIGRATION.md` — complete v7 → v8 migration reference
6. The playground directory structure (check `packages/react/playground/` or sibling dirs)
