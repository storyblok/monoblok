---
title: "Migrate to @storyblok/react 8.x"
description: "Upgrade a React application from @storyblok/react 7.x to 8.x."
---

# Migrate to @storyblok/react 8.x

`@storyblok/react` 8.x is a ground-up redesign of the SDK. Version 8.x:

- Removes the global `storyblokInit()` component registry.
- Moves all data fetching to the framework-agnostic [`@storyblok/api-client`](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client).
- Fully supports React Server Components (RSC), with dedicated entry points for client-rendered and server-rendered apps.

This guide explains how to update the initialization, data fetching, and component registration code of apps that import `@storyblok/react`, `@storyblok/react/ssr`, or `@storyblok/react/rsc`. Block components need smaller updates: the renamed `block` prop, the injected `editable` prop, and `StoryblokBlocks` for nested blocks.

> [!CAUTION]
> Version 8.x is a release candidate. The API can still change before the stable release. For details, refer to the [@storyblok/react (Version 8.x RC) reference](https://www.storyblok.com/docs/libraries/js/react-sdk/v8rc).

## Requirements

- **React** version 18 or later (version 8.x drops support for React 17)
- **Node.js** LTS (version 22.x recommended)

## Migration steps

Follow these steps to migrate an application:

1. [Upgrade](#update-the-packages) `@storyblok/react` and add `@storyblok/api-client`.
2. [Create one `apiClient` instance](#create-the-api-client) per app and move the `apiOptions` of `storyblokInit()` to `createApiClient()`. A custom `endpoint` becomes `baseUrl`, without the `/v2` path. Replace `useStoryblokApi()` and `getStoryblokApi()` calls with `apiClient.stories.get()`.
3. [Replace `storyblokInit({ components })`](#register-blocks) with `defineStoryblokBlocks({ components })`. Export its `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText` from one module.
4. [Remove the `storyblokInit()` call](#remove-client-side-initialization) from the entry file of client-rendered apps, and delete Client Components that only call `storyblokInit()` or `getStoryblokApi()`.
5. [Rename `blok` to `block`](#update-block-components) in every block component. Replace manual `storyblokEditable(blok)` calls with the injected `editable` prop, and render nested blocks with `StoryblokBlocks` instead of `StoryblokComponent`.
6. In client-rendered apps and static output, [replace `useStoryblok()`, `useStoryblokBridge()`, and `@storyblok/react/ssr`](#fetch-and-render-without-live-editing) with a fetch through `apiClient` and `StoryblokBlock`. [Wrap the content in `StoryblokPreview`](#client-rendered-apps) wherever the app needs live editing.
7. In Next.js App Router apps, [replace `StoryblokStory`](#server-rendered-apps) with `StoryblokPreview` from `@storyblok/react/rsc` and a `renderContent` Server Action.
8. [Replace `StoryblokServerComponent`](#update-block-components) with `StoryblokBlock` or `StoryblokBlocks`, and import everything other than `StoryblokPreview` from `@storyblok/react` instead of `@storyblok/react/rsc`.
9. [Import `StoryblokRichText`](#update-rich-text) from the module that calls `defineStoryblokBlocks()`, and import rich text utilities from `@storyblok/richtext`.
10. [Update type imports](#update-types).

## Summary of changes

Version 8.x has no global client or component registry. The following tables list the APIs that version 8.x removes, adds, and changes.

### Removed

| Removed in version 8.x                                                                                                                             | Replacement                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `storyblokInit()`, `apiPlugin`, `setComponents()`, `useStoryblokApi()`, `getStoryblokApi()`                                                        | `defineStoryblokBlocks()`, and `createApiClient()` from `@storyblok/api-client`  |
| `useStoryblok()`, `useStoryblokBridge()`, `registerStoryblokBridge()`, `loadStoryblokBridge()`                                                     | A fetch through `apiClient`, and `StoryblokPreview` for live editing             |
| The `@storyblok/react/ssr` entry point, `StoryblokServerStory`, `StoryblokServerComponent`                                                         | A fetch through `apiClient`, rendered with `StoryblokBlock` or `StoryblokBlocks` |
| `StoryblokStory` from `@storyblok/react/rsc`                                                                                                       | `StoryblokPreview` from `@storyblok/react/rsc`                                   |
| `StoryblokComponent`                                                                                                                               | `StoryblokBlock` and `StoryblokBlocks`, returned by `defineStoryblokBlocks()`    |
| `StoryblokRichText` as a direct export of `@storyblok/react`, and `StoryblokServerRichText` from `@storyblok/react/rsc` and `@storyblok/react/ssr` | The `StoryblokRichText` returned by `defineStoryblokBlocks()`                    |
| `useStoryblokRichText()`, `useStoryblokServerRichText()`                                                                                           | `createRichTextRenderer()`                                                       |

### Added

| Added in version 8.x      | Description                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineStoryblokBlocks()` | Replaces the `components` option of `storyblokInit()`. Returns `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText`, bound to one component map. |
| `StoryblokBlocks`         | Renders an array of blocks, replacing manual `.map()` calls over `StoryblokBlock`.                                                                       |
| `@storyblok/api-client`   | The recommended way to fetch stories. The React SDK no longer bundles an API client or depends on the JS SDK.                                            |
| `StoryblokPreview`        | Enables live editing. In `@storyblok/react/rsc`, `StoryblokPreview` is a Server Component that re-renders live content through a Server Action.          |

### Changed

| Change                                                      | What to update                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The block prop is `block` instead of `blok`                 | Rename the prop in every block component. `StoryblokBlock` also injects the result of `storyblokEditable()` as an `editable` prop. |
| `@storyblok/react/rsc` exports only `StoryblokPreview`      | Import everything else, such as `storyblokEditable`, from `@storyblok/react`.                                                      |
| `useStoryblokState()` options go in an object               | Use `useStoryblokState(story, { bridgeOptions, debounceMs })`.                                                                     |
| `@storyblok/react` no longer re-exports rich text utilities | Import utilities such as `splitTableRows` from `@storyblok/richtext`.                                                              |

## Update the packages

Upgrade `@storyblok/react` to the release candidate and add `@storyblok/api-client` to the project:

<!-- TODO: @rc resolves to 8.0.0-rc.0 with @storyblok/api-client 0.9.0 (latest). Switch to @storyblok/react@latest when 8.0.0 stable ships. -->

```bash
npm install @storyblok/react@rc @storyblok/api-client
```

## Create the API client

Replace `apiPlugin` and `useStoryblokApi()` with `@storyblok/api-client`. Create one client instance and export the client next to the component map.

The examples in this guide import from `@/`, a path alias for `src/`. In a project without the alias, use relative imports.

**Version 8.x:**

```jsx title="src/lib/storyblok.js" wrap
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import Page from "@/components/Page";
import Feature from "@/components/Feature";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock, StoryblokBlocks, StoryblokRichText } = defineStoryblokBlocks({
  components: { page: Page, feature: Feature },
});
```

**Version 7.x:**

```jsx wrap
import { apiPlugin, storyblokInit } from "@storyblok/react";

storyblokInit({
  accessToken: "YOUR_ACCESS_TOKEN",
  use: [apiPlugin],
  apiOptions: { region: "eu" },
  components: { page: Page, feature: Feature },
});
```

Move the options of `storyblokInit()` to `createApiClient()`:

| Version 7.x (`storyblokInit()`)                          | Version 8.x (`createApiClient()`)         |
| -------------------------------------------------------- | ----------------------------------------- |
| `accessToken`                                            | `accessToken`                             |
| `apiOptions.region`                                      | `region`                                  |
| `apiOptions.endpoint: "https://api-us.storyblok.com/v2"` | `baseUrl: "https://api-us.storyblok.com"` |

`baseUrl` takes only the origin, because the client adds the `/v2` path itself. If the options include both, `baseUrl` takes precedence over `region`. Spell the option `baseUrl` exactly: `createApiClient()` ignores unknown options such as `baseURL` without an error.

> [!CAUTION]
> `createApiClient()` throws when the module loads if `accessToken` is `undefined`, with an error that doesn’t mention the token. Set the token environment variable everywhere the app builds, including CI.

Fetch stories directly from `apiClient` wherever the application used to call `useStoryblokApi()` or `storyblokApi.get()`:

**Version 8.x:**

```js wrap
const { data } = await apiClient.stories.get(slug, { query: { version: "draft" } });
```

**Version 7.x:**

```js wrap
const storyblokApi = useStoryblokApi();
const { data } = await storyblokApi.get(`cdn/stories/${slug}`, { version: "draft" });
```

`apiClient.stories.get()` takes the slug without the `cdn/stories/` prefix, and API parameters such as `version` go in the `query` object.

Unlike version 7.x, `apiClient.stories.get()` doesn’t throw when a request fails, for example, when a story doesn’t exist. It returns `{ data, error }`, with `data` undefined on failure. Check `data` or `error` before rendering, or pass `throwOnError: true` to `createApiClient()` to keep the 7.x behavior.

## Register blocks

`defineStoryblokBlocks()` replaces `storyblokInit({ components })`. The function builds the component map once and returns `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText` bound to that map. Every route or app can define its own map instead of relying on one process-wide registry:

```jsx wrap
export const { StoryblokBlock, StoryblokBlocks, StoryblokRichText } = defineStoryblokBlocks({
  components: {
    page: Page,
    teaser: Teaser,
    // Lazy-load slow components and wrap them in Suspense
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true,
    },
  },
  // Replaces enableFallbackComponent and customFallbackComponent
  fallback: FallbackComponent,
});
```

Throughout the app, import `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText` from `src/lib/storyblok.js`. In version 7.x, `@storyblok/react` exported `StoryblokComponent` and `StoryblokRichText` directly. `StoryblokBlock` replaces `StoryblokComponent`.

Block components import `StoryblokBlocks` from the same module that imports them. This circular import works, because React reads `StoryblokBlocks` only when rendering.

`StoryblokBlock` wraps components created with `React.lazy()` in `Suspense` automatically. To wrap any other asynchronous or slow component, set `suspense: true`.

## Remove client-side initialization

Version 8.x has no global initialization, and `StoryblokPreview` loads the Storyblok Bridge itself.

In a client-rendered app, delete the `storyblokInit()` call from the entry file, for example, `src/main.jsx`, and move the block component imports to the module that calls `defineStoryblokBlocks()`.

If a Next.js App Router app loads the Storyblok Bridge with a Client Component that calls `storyblokInit()` or `getStoryblokApi()`, remove the component from the root layout, then delete the file.

## Update block components

Every component registered in the map receives a `block` prop and an `editable` prop. `StoryblokBlock` injects `editable` automatically, so components no longer need to import `storyblokEditable`. Rename `blok` to `block` and spread `editable` onto the root element:

**Version 8.x:**

```jsx title="src/components/Feature.jsx" wrap
export default function Feature({ block, editable }) {
  return (
    <div {...editable}>
      <h2>{block.name}</h2>
    </div>
  );
}
```

**Version 7.x:**

```jsx title="src/components/Feature.jsx" wrap
import { storyblokEditable } from "@storyblok/react";

export default function Feature({ blok }) {
  return (
    <div {...storyblokEditable(blok)}>
      <h2>{blok.name}</h2>
    </div>
  );
}
```

`@storyblok/react` still exports `storyblokEditable()` for components that aren’t rendered through `StoryblokBlock`.

In version 7.x, block components rendered nested blocks by mapping over the array with `StoryblokComponent`, or `StoryblokServerComponent` in Server Components. Version 8.x removes both. Render nested blocks with `StoryblokBlocks` instead, in both Client and Server Components:

```jsx title="src/components/Page.jsx" wrap
import { StoryblokBlocks } from "@/lib/storyblok";

export default function Page({ block, editable }) {
  return <div {...editable}>{block.body && <StoryblokBlocks blocks={block.body} />}</div>;
}
```

## Fetch and render without live editing

To fetch and render content, use `apiClient` and `StoryblokBlock`. The following example works in a Server Component, a static export, or a route loader:

```jsx title="src/app/[slug]/page.js" wrap
import { notFound } from "next/navigation";
import { apiClient, StoryblokBlock } from "@/lib/storyblok";

export default async function Page({ params }) {
  const { slug } = await params;
  const { data } = await apiClient.stories.get(slug, { query: { version: "draft" } });

  if (!data?.story) {
    notFound();
  }

  return <StoryblokBlock block={data.story.content} />;
}
```

For fetching and rendering without live editing, `apiClient` and `StoryblokBlock` replace `useStoryblok()`, `StoryblokServerStory`, and the removed server-side rendering entry point. The replacement covers static rendering, static export, and any output where the Storyblok Bridge isn’t needed.

## Set up live preview

Version 8.x replaces `useStoryblok()`, `useStoryblokBridge()`, and `StoryblokStory` with `StoryblokPreview`. The entry point to import `StoryblokPreview` from depends on how the application renders.

### Client-rendered apps

In version 7.x, `useStoryblok()` fetched the story, tracked the loading state, and subscribed to the Storyblok Bridge. In version 8.x, the app fetches the story and owns the loading state. Import `StoryblokPreview` from `@storyblok/react` for live editing. `StoryblokPreview` holds the story in state and calls `renderContent` again on every change in the Visual Editor.

**Version 8.x:**

```jsx title="src/StoryPage.jsx" wrap
import useSWR from "swr";
import { StoryblokPreview } from "@storyblok/react";
import { apiClient, StoryblokBlock } from "@/lib/storyblok";

async function fetchStory(slug) {
  const { data, error } = await apiClient.stories.get(slug, { query: { version: "draft" } });
  if (error) throw error;
  return data.story;
}

export default function StoryPage({ slug }) {
  const { data: story, error, isLoading } = useSWR(slug, fetchStory);

  if (isLoading) return <div>Loading...</div>;
  if (error || !story) return <div>Story not found.</div>;

  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => (live.content ? <StoryblokBlock block={live.content} /> : null)}
    />
  );
}
```

**Version 7.x:**

```jsx title="src/StoryPage.jsx" wrap
import { StoryblokComponent, useStoryblok } from "@storyblok/react";

export default function StoryPage({ slug }) {
  const story = useStoryblok(slug, { version: "draft" });

  if (!story?.content) return <div>Loading...</div>;

  return <StoryblokComponent blok={story.content} />;
}
```

This example fetches with [SWR](https://swr.vercel.app/docs/getting-started), installed with `npm install swr`. Any approach that fetches the story once with `apiClient` works, for example, a route loader. When the `story` prop changes, for example, after navigating to another route, `StoryblokPreview` picks up the new story automatically, so it doesn’t need a `key`.

When a render function doesn’t fit, for example, inside an existing custom hook, use the `useStoryblokState(story)` hook directly.

### Server-rendered apps

`@storyblok/react/rsc` requires React 19 and Server Actions. For React 18, `output: 'export'`, or any app that doesn’t use React Server Components, use `StoryblokPreview` from `@storyblok/react` instead.

For the Next.js App Router and other React Server Components setups, import `StoryblokPreview` from `@storyblok/react/rsc`. First, define the Server Action in a separate file:

```jsx title="src/lib/actions.js" wrap
"use server";

import { StoryblokBlock } from "@/lib/storyblok";

export async function renderContent(story) {
  return story.content ? <StoryblokBlock block={story.content} /> : null;
}
```

In this entry point, `StoryblokPreview` is a Server Component. `StoryblokPreview` awaits the `renderContent` Server Action for the initial render, then calls the Server Action again on every change in the Visual Editor and streams the result in. Live editing works without adding a client-side Storyblok Bridge subscription to every route.

Pass the Server Action to `StoryblokPreview`:

```jsx title="src/app/[[...slug]]/page.js" wrap
import { notFound } from "next/navigation";
import { StoryblokPreview } from "@storyblok/react/rsc";
import { renderContent } from "@/lib/actions";
import { apiClient } from "@/lib/storyblok";

export default async function CatchAllPage({ params }) {
  const { slug } = await params;
  const { data } = await apiClient.stories.get(slug?.join("/") || "home", {
    query: { version: "draft" },
  });

  if (!data?.story) {
    notFound();
  }

  return <StoryblokPreview story={data.story} renderContent={renderContent} />;
}
```

### Pages with data fetching methods

On the Next.js Pages Router, fetch the story in `getStaticProps` or `getServerSideProps` as before, then render the story with `StoryblokPreview` from `@storyblok/react`, as in other client-rendered apps:

```jsx title="src/pages/index.js" wrap
import { StoryblokPreview } from "@storyblok/react";
import { apiClient, StoryblokBlock } from "@/lib/storyblok";

export default function Home({ story }) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => (live.content ? <StoryblokBlock block={live.content} /> : null)}
    />
  );
}

export async function getStaticProps() {
  const { data } = await apiClient.stories.get("home", { query: { version: "draft" } });

  if (!data) {
    return { notFound: true };
  }

  return { props: { story: data.story }, revalidate: 3600 };
}
```

## Update rich text

Use the `StoryblokRichText` component returned by `defineStoryblokBlocks()`. `StoryblokRichText` renders embedded blocks through the same component map. To render rich text without the component map, use the standalone `createRichTextRenderer()` function. The function renders embedded blocks only when its `components` option includes a custom component for the `blok` rich text node.

| Version 7.x                                                                                                                                          | Version 8.x                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `StoryblokRichText` from `@storyblok/react`, and `StoryblokServerRichText` from `@storyblok/react/rsc` and `@storyblok/react/ssr`                    | `StoryblokRichText` returned by `defineStoryblokBlocks()` |
| `useStoryblokRichText()` and `useStoryblokServerRichText()`                                                                                          | `createRichTextRenderer()`                                |
| `splitTableRows`, `buildStoryblokImage`, and `renderRichText` from `@storyblok/react`                                                                | The same utilities from `@storyblok/richtext`             |
| Custom node and mark components, the `components` and `optimizeImage` props, `StoryblokReactRichTextProps`, and `StoryblokReactRichTextComponentMap` | Unchanged                                                 |

For example:

**Version 8.x:**

```jsx wrap
import { StoryblokRichText } from "@/lib/storyblok";

<StoryblokRichText document={block.richtext_field} />;
```

**Version 7.x:**

```jsx wrap
import { StoryblokRichText } from "@storyblok/react";

<StoryblokRichText document={blok.richtext_field} />;
```

## Update types

For TypeScript projects, version 8.x renames the following types:

| Version 7.x                   | Version 8.x                          |
| ----------------------------- | ------------------------------------ |
| `ISbStoryData`                | `Story`                              |
| `SbBlokData`                  | `StoryblokBlockData`                 |
| `SbReactRichTextProps`        | `StoryblokReactRichTextProps`        |
| `SbReactRichTextComponentMap` | `StoryblokReactRichTextComponentMap` |

`StoryblokBlockData` describes the minimal shape of a block passed through `StoryblokBlock`.

Version 8.x also introduces the following types:

- `StoryblokBlockComponentProps`: the recommended type for the props of a block component (`block` and `editable`).
- `LivePreviewStory`: the story type that `StoryblokPreview` passes to `renderContent` and that `useStoryblokState` returns.

## Further resources

- [Repository Playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground)—Find every scenario in this guide in the repository playgrounds: client-rendered single-page app, Pages Router, App Router with RSC live preview, and static export.
- [@storyblok/react (Version 8.x RC) Package Reference](https://www.storyblok.com/docs/libraries/js/react-sdk/v8rc)—Learn about every component, hook, and helper in the @storyblok/react 8.x reference.
- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
