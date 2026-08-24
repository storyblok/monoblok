# Migration Guide — `@storyblok/react` v7 → v8

This guide covers every breaking change in the new API. v8 is a ground-up simplification: the global
singleton is gone, the plugin system is gone, and the entry points are reorganised around Next.js
App Router idioms. If you are coming from v7, read every section — the changes are broad.

---

## Table of Contents

- [At a glance](#at-a-glance)
- [Installation](#installation)
- [Entry points](#entry-points)
- [Initialisation — `storyblokInit` is gone](#initialisation--storyblokInit-is-gone)
- [API client](#api-client)
- [Component registry](#component-registry)
- [Rendering bloks](#rendering-bloks)
- [Live preview (CSR / SPA)](#live-preview-csr--spa)
- [Live preview (RSC / Next.js App Router)](#live-preview-rsc--nextjs-app-router)
- [Story fetching](#story-fetching)
- [Rich text](#rich-text)
- [Types](#types)
- [Removed exports — full list](#removed-exports--full-list)
- [Retained helpers](#retained-helpers)

---

## At a glance

| Area             | v7                                           | v8                                                                                  |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Setup            | `storyblokInit({ accessToken, components })` | `createApiClient(…)` + `createRegistry(…)`                                          |
| API client       | `getStoryblokApi()` singleton                | `client` instance from `createApiClient`                                            |
| Component map    | `storyblokInit({ components })` global       | `createRegistry({ components })` — returns `StoryblokComponent` + `StoryblokBlocks` |
| Story fetch hook | `useStoryblok(slug, apiOptions)`             | call `client.stories.get(slug)` directly                                            |
| Bridge hook      | `useStoryblokState(story)`                   | `StoryblokPreview` render-prop component                                            |
| RSC live editing | `StoryblokStory` + `liveEditUpdateAction`    | `StoryblokPreviewRsc` + your own Server Action                                      |
| Story type       | `ISbStoryData`                               | `Story` (from `@storyblok/api-client`)                                              |
| Suspense support | none                                         | `suspense: true` per component in registry                                          |
| Debounce         | none                                         | `debounceMs` prop on `StoryblokPreviewRsc` (default 300 ms)                         |
| Entry points     | `/`, `/ssr`, `/rsc`                          | `/next`, `/next/rsc`                                                                |

---

## Installation

```bash
# Remove the old package (same name, new major)
npm remove @storyblok/react

# Install v8
npm install @storyblok/react@next
```

No additional peer packages are required; `@storyblok/api-client` and `@storyblok/live-preview` are
bundled or declared as dependencies by the SDK itself.

---

## Entry points

| v7 import path         | v8 import path              | Notes                                                             |
| ---------------------- | --------------------------- | ----------------------------------------------------------------- |
| `@storyblok/react`     | `@storyblok/react/next`     | Main entry for Next.js App Router                                 |
| `@storyblok/react/rsc` | `@storyblok/react/next/rsc` | `StoryblokPreview` for RSC live editing                           |
| `@storyblok/react/ssr` | removed                     | SSR-safe server rendering is now the default in the `/next` entry |

---

## Initialisation — `storyblokInit` is gone

**v7**

```ts
import { storyblokInit, apiPlugin } from "@storyblok/react";

storyblokInit({
  accessToken: "...",
  use: [apiPlugin],
  components: {
    page: Page,
    teaser: Teaser,
  },
  enableFallbackComponent: true,
  customFallbackComponent: MyFallback,
});
```

**v8**

```ts
// app/lib/storyblok.tsx
import { createApiClient, createRegistry } from "@storyblok/react/next";

export const client = createApiClient({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_DELIVERY_API_TOKEN!,
  region: process.env.NEXT_PUBLIC_STORYBLOK_REGION as "us" | "eu",
});

export const { StoryblokComponent, StoryblokBlocks } = createRegistry({
  components: {
    page: Page,
    teaser: Teaser,
  },
  fallback: MyFallback,
});
```

Key differences:

- No global singleton. `client` and the registry are plain module-level values — import them
  wherever you need them.
- `apiPlugin` is removed. The API client is now configured directly via `createApiClient`.
- `enableFallbackComponent` flag is replaced by the `fallback` option in `createRegistry`.
- `setComponents()` is removed. The registry is closed after `createRegistry` is called.

---

## API client

**v7**

```ts
import { getStoryblokApi } from "@storyblok/react";

const client = getStoryblokApi();
const { data } = await client.get("cdn/stories/home", { version: "published" });
```

**v8**

```ts
import { client } from "@/lib/storyblok"; // your createApiClient instance

const { data } = await client.stories.get("home", {
  query: { version: "published" },
});
```

- `getStoryblokApi()` and `useStoryblokApi()` are removed.
- The v8 client uses a resource-oriented API (`client.stories.get`, `client.stories.list`, …) backed
  by the OpenAPI-generated `@storyblok/api-client`, so all parameters and responses are fully typed.
- The raw `client.get("cdn/stories/…")` path no longer exists. Use the typed resource methods
  instead.

---

## Component registry

**v7** — global side-effect, `StoryblokComponent` imported directly

```tsx
import { StoryblokComponent } from "@storyblok/react";

// renders via the global component map set in storyblokInit
<StoryblokComponent blok={blok} />;
```

**v8** — registry-scoped, `StoryblokComponent` comes from your registry

```tsx
// app/lib/storyblok.tsx
export const { StoryblokComponent, StoryblokBlocks } = createRegistry({ … });

// anywhere in your app
import { StoryblokComponent, StoryblokBlocks } from "@/lib/storyblok";

<StoryblokComponent blok={blok} />
<StoryblokBlocks blocks={blok.body} />
```

- `StoryblokComponent` is no longer a singleton export from the package — it is an instance returned
  by `createRegistry`.
- `StoryblokBlocks` is new: it iterates an array of bloks and renders each via `StoryblokComponent`.
  In v7 you had to do this manually.
- `StoryblokServerComponent` and `StoryblokServerStory` from `@storyblok/react/ssr` are removed. The
  registry components are server-safe by default in v8.

### Per-component Suspense (new in v8)

```tsx
createRegistry({
  components: {
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true, // wraps WeatherWidget in a <Suspense> boundary automatically
    },
  },
});
```

In v7 you had to wrap async components in `<Suspense>` manually at every callsite. In v8 the
registry handles it.

---

## Rendering bloks

**v7 — manual `StoryblokComponent` loop**

```tsx
{
  blok.body.map((nestedBlok) => <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />);
}
```

**v8 — `StoryblokBlocks`**

```tsx
<StoryblokBlocks blocks={blok.body} />
```

Both approaches work in v8 (you can still use `StoryblokComponent` directly), but `StoryblokBlocks`
is the preferred idiom.

---

## Live preview (CSR / SPA)

**v7**

```tsx
import { useStoryblok } from "@storyblok/react";

function Page({ slug }) {
  const story = useStoryblok(slug, { version: "draft" });
  if (!story?.content) return null;
  return <StoryblokComponent blok={story.content} />;
}
```

**v8 — render-prop `StoryblokPreview`**

```tsx
"use client";
import { StoryblokPreview } from "@storyblok/react/next";

// story is fetched by the parent (server component or route loader)
function Preview({ story }) {
  return (
    <StoryblokPreview story={story}>
      {(currentStory) => <StoryblokComponent blok={currentStory.content} />}
    </StoryblokPreview>
  );
}
```

Changes:

- `useStoryblok` is removed. Fetching and live-preview bridging are now separate concerns.
- `useStoryblokState` is removed. Use `StoryblokPreview` instead.
- Bridge setup (`registerStoryblokBridge`, `useStoryblokBridge`) is now internal to
  `@storyblok/live-preview`. You no longer call these directly.
- `StoryblokPreview` uses a render prop (`children` is a function) so the component that renders
  story content is always called with the latest story — no extra state wiring needed.

---

## Live preview (RSC / Next.js App Router)

This is the most significant change for App Router users.

### v7 approach

```tsx
// /rsc entry
import { StoryblokStory } from "@storyblok/react/rsc";

// StoryblokStory bundled fetching + live editing internally via liveEditUpdateAction
<StoryblokStory slug="home" />;
```

- `StoryblokStory` fetched the story itself, rendered it, and managed live editing via a
  server-action + `globalThis.storyCache` + `revalidatePath()`.
- `StoryblokLiveEditing` and `liveEditUpdateAction` were internals of the RSC entry that you would
  sometimes import directly.

### v8 approach

```tsx
// app/[[...slug]]/page.tsx
import { StoryblokPreview } from "@storyblok/react/next/rsc";
import { renderContent } from "@/lib/actions";
import { client, isPreview } from "@/lib/storyblok";

export default async function Page({ params }) {
  const { data } = await client.stories.get(params.slug ?? "home", {
    query: { version: isPreview ? "draft" : "published" },
  });
  const story = data?.story;
  if (!story) return <div>Not found</div>;

  const content = <StoryContent story={story} />;
  if (!isPreview) return content;

  return <StoryblokPreview renderContent={renderContent}>{content}</StoryblokPreview>;
}
```

```tsx
// app/lib/actions.tsx
"use server";
import type { Story } from "@storyblok/react/next";
import { StoryContent } from "@/components/StoryContent";

export async function renderContent(story: Story) {
  return <StoryContent story={story} />;
}
```

Changes:

- `StoryblokStory` is removed. Fetch the story yourself with `client.stories.get`.
- `StoryblokLiveEditing` and `liveEditUpdateAction` are removed. `StoryblokPreview` handles live
  editing internally.
- `globalThis.storyCache` / `revalidatePath` trick is gone. `StoryblokPreview` uses `React.use()` +
  `<Suspense>` to stream the updated RSC payload without blocking Suspense boundaries in the tree.
- You supply your own `renderContent` Server Action. This gives you full control over what
  re-renders on editor updates.
- `debounceMs` (default 300 ms) prevents a Server Action call on every keystroke.

### Recommended two-deployment strategy

v8 replaces Next.js Draft Mode cookies with a static `STORYBLOK_ENV` flag:

```ts
export const isPreview = process.env.STORYBLOK_ENV === "preview";
```

Set `STORYBLOK_ENV=preview` only on your preview deployment. Production never sets it. This
eliminates per-request cookie checks and makes caching completely predictable.

---

## Story fetching

**v7** (inside a useEffect / server component)

```ts
const client = getStoryblokApi();
const { data } = await client.get("cdn/stories/home", {
  version: "draft",
  resolve_relations: "article.author",
});
const story: ISbStoryData = data.story;
```

**v8**

```ts
const { data } = await client.stories.get("home", {
  query: {
    version: "draft",
    resolve_relations: ["article.author"],
  },
});
const story: Story = data?.story;
```

- The raw `client.get("cdn/stories/…")` path is gone. Use `client.stories.get` /
  `client.stories.list`.
- Query parameters are nested under a `query` object and are typed by the OpenAPI spec, so you get
  autocomplete and type errors for invalid params.

---

## Rich text

The rich-text API surface (`useStoryblokRichText`, `StoryblokRichText`, `createRichTextRenderer`,
`createStoryblokRichText`) is not yet documented as part of the v8 new-API surface in `guide.md`.

**Assume it is unchanged for now.** Continue importing from `@storyblok/react` (v7) until the v8
rich-text API is finalised. This section will be updated.

---

## Types

| v7 type                                                                         | v8 replacement                                | Notes                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `ISbStoryData`                                                                  | `Story`                                       | from `@storyblok/react/next` (re-exported from `@storyblok/api-client`) |
| `ISbStoriesParams`                                                              | typed `query` object on `client.stories.list` | inferred from the typed client                                          |
| `SbBlokData`                                                                    | `SbBlokData`                                  | still exported from `@storyblok/react/next`                             |
| `StoryblokBridgeConfigV2`                                                       | removed                                       | bridge is internal to `@storyblok/live-preview`                         |
| `StoryblokBridgeV2`                                                             | removed                                       | same reason                                                             |
| `SbReactSDKOptions`                                                             | removed                                       | init options live in `createApiClient` / `createRegistry`               |
| `SbReactComponentsMap`                                                          | removed                                       | component map is inferred by `createRegistry`                           |
| `StoryblokComponentType`                                                        | removed                                       | use React component types directly                                      |
| `ISbRichtext`, `ISbLink`, etc.                                                  | unchanged                                     | still re-exported from `@storyblok/js` internals                        |
| Deprecated aliases (`SbReactRichTextComponentMap`, `StoryblokRichTextProps`, …) | removed                                       |                                                                         |

---

## Removed exports — full list

The following are exported in v7 but do not exist in v8.

### Hooks

| Export                                          | Reason removed                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `useStoryblok(slug, apiOptions, bridgeOptions)` | Fetch + bridge separation. Use `client.stories.get` + `StoryblokPreview`. |
| `useStoryblokState(story, bridgeOptions)`       | Replaced by `StoryblokPreview` render prop.                               |
| `useStoryblokApi()`                             | Replaced by `client` instance from `createApiClient`.                     |
| `useStoryblokBridge(…)`                         | Internal to `@storyblok/live-preview`.                                    |

### Functions

| Export                           | Reason removed                                    |
| -------------------------------- | ------------------------------------------------- |
| `storyblokInit(options)`         | Replaced by `createApiClient` + `createRegistry`. |
| `getStoryblokApi()`              | Same as `useStoryblokApi`.                        |
| `getComponent(key)`              | Registry internals are no longer public.          |
| `setComponents(map)`             | Registry is immutable after `createRegistry`.     |
| `getCustomFallbackComponent()`   | Absorbed into `createRegistry({ fallback })`.     |
| `getEnableFallbackComponent()`   | Same.                                             |
| `apiPlugin`                      | No plugin system in v8.                           |
| `loadStoryblokBridge(…)`         | Internal to `@storyblok/live-preview`.            |
| `registerStoryblokBridge(…)`     | Same.                                             |
| `convertAttributesInElement(el)` | Was already deprecated in v7. Removed.            |

### Components

| Export                                         | Reason removed                                         |
| ---------------------------------------------- | ------------------------------------------------------ |
| `StoryblokComponent` (package-level singleton) | Now an instance from `createRegistry`.                 |
| `StoryblokServerComponent` (from `/ssr`)       | Registry components are server-safe by default.        |
| `StoryblokServerStory` (from `/ssr`)           | Replaced by `client.stories.get` + `StoryblokPreview`. |
| `StoryblokServerRichText` (from `/ssr`)        | Rich-text API TBD.                                     |
| `StoryblokStory` (from `/rsc`)                 | Replaced by `client.stories.get` + `StoryblokPreview`. |
| `StoryblokLiveEditing` (from `/rsc`)           | Internal to `StoryblokPreview`.                        |

### Server actions / internals

| Export                               | Reason removed                                                     |
| ------------------------------------ | ------------------------------------------------------------------ |
| `liveEditUpdateAction` (from `/rsc`) | Replaced by user-supplied Server Action passed as `renderContent`. |

### Utility functions

| Export             | Status                                           |
| ------------------ | ------------------------------------------------ |
| `isBrowser()`      | Status TBD — not present in the new API surface. |
| `isServer()`       | Status TBD.                                      |
| `isBridgeLoaded()` | Status TBD.                                      |
| `isIframe()`       | Status TBD.                                      |
| `isVisualEditor()` | Status TBD.                                      |

---

## Retained helpers

| Export                    | Entry point                  | Notes                                                    |
| ------------------------- | ---------------------------- | -------------------------------------------------------- |
| `storyblokEditable(blok)` | `@storyblok/react/next`      | Unchanged                                                |
| `SbBlokData`              | `@storyblok/react/next`      | Unchanged                                                |
| `Story`                   | `@storyblok/react/next`      | New — replaces `ISbStoryData`                            |
| `StoryblokPreview` (CSR)  | `@storyblok/react/next`      | New — replaces `useStoryblok` / `useStoryblokState`      |
| `StoryblokPreview` (RSC)  | `@storyblok/react/next/rsc`  | New — replaces `StoryblokStory` / `StoryblokLiveEditing` |
| `createApiClient`         | `@storyblok/react/next`      | New — replaces `storyblokInit + apiPlugin`               |
| `createRegistry`          | `@storyblok/react/next`      | New — replaces `storyblokInit({ components })`           |
| `StoryblokComponent`      | returned by `createRegistry` | Instance, not a package export                           |
| `StoryblokBlocks`         | returned by `createRegistry` | New                                                      |
