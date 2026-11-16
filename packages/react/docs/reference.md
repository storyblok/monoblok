---
title: "@storyblok/react"
description: "@storyblok/react is Storyblok’s official SDK for React applications."
---

# @storyblok/react

[@storyblok/react](https://github.com/storyblok/monoblok/tree/main/packages/react) is Storyblok’s
official SDK for React applications.

Version 8.x separates rendering from data fetching. Fetch content with
[`@storyblok/api-client`](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client),
and render it with the components returned by `defineStoryblokBlocks`. To upgrade from version 7.x,
follow the
[migration guide](https://www.storyblok.com/docs/libraries/js/react-sdk/migration-from-v7).

## Requirements

- **React** version 18 or 19 (version 19 for React Server Components)
- **Node.js** LTS (version 22.x recommended)
- **Evergreen web browser** (for example, Chrome, Firefox, Safari, or Edge)

The package is ESM-only and doesn’t ship a CommonJS build.

## Installation

Add the SDK and the Storyblok API client to a project by running this command in the terminal:

```bash
npm install @storyblok/react@rc @storyblok/api-client
```

## Usage

How to configure the SDK, register components, and render stories. The SDK provides two entry points
for different rendering modes:

| Export                 | When to use                                                                                               | How to use                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@storyblok/react`     | All environments: client-rendered and single-page apps, static export, and Server Components.             | Use **`defineStoryblokBlocks`** to render content. Use **`StoryblokPreview`** or **`useStoryblokState`** for live editing in client-rendered apps.                        |
| `@storyblok/react/rsc` | Next.js App Router and other React Server Components (RSC) setups that support Server Actions (React 19). | Use **`StoryblokPreview`** for live editing. Its `renderContent` prop is a Server Action, so the content re-renders on the server with every change in the Visual Editor. |

### Configuration

Create an
[`@storyblok/api-client`](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)
instance with the space’s [access token](https://www.storyblok.com/docs/concepts/access-tokens), and
register the React components that render each block.

```jsx
// src/lib/storyblok.js
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => ({
  components: {
    page: Page,
    teaser: Teaser,
  },
}));
```

The `region` parameter is required for non-EU spaces. For details, refer to the
[`@storyblok/api-client` reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#region).

### Components

Create a React component for each block defined in Storyblok and registered in the configuration.
Each component receives a `block` prop that contains the block’s content, and an `editable` prop.

```jsx
// src/components/Teaser.jsx
export default function Teaser({ block, editable }) {
  return (
    <div {...editable}>
      <h2>{block.headline}</h2>
    </div>
  );
}
```

To render nested blocks, map over the array and render each block with `StoryblokBlock`, using the
`_uid` of the block as the `key`.

```jsx
// src/components/Page.jsx
import { StoryblokBlock } from "@/lib/storyblok";

export default function Page({ block, editable }) {
  return (
    <main {...editable}>
      {block.body?.map((nestedBlock) => (
        <StoryblokBlock key={nestedBlock._uid} block={nestedBlock} />
      ))}
    </main>
  );
}
```

Block components import `StoryblokBlock` from the module that imports them. This circular import
works, because `defineStoryblokBlocks()` calls its function on the first render, after every module
has loaded.

### Fetching and rendering

Use the API client to fetch a story and render its content with `StoryblokBlock`.

In a React Server Component, fetch the story directly:

```jsx
// src/app/page.js
import { notFound } from "next/navigation";
import { apiClient, StoryblokBlock } from "@/lib/storyblok";

export default async function Home() {
  const { data } = await apiClient.stories.get("home", {
    query: { version: "draft" },
  });

  if (!data?.story) {
    notFound();
  }

  return <StoryblokBlock block={data.story.content} />;
}
```

In a client-rendered application, use a data-fetching library such as
[SWR](https://swr.vercel.app/docs/getting-started) or
[React Query](https://tanstack.com/query/latest/docs/framework/react/overview) alongside the API
client. These libraries handle loading and error states, and cache the fetched stories:

```jsx
// src/App.jsx
import useSWR from "swr";
import { apiClient, StoryblokBlock } from "@/lib/storyblok";

async function fetchStory(slug) {
  const { data } = await apiClient.stories.get(slug, {
    query: { version: "draft" },
  });
  if (!data) throw new Error(`Story not found: ${slug}`);
  return data.story;
}

export default function App() {
  const { data: story, error } = useSWR("home", fetchStory);

  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return <StoryblokBlock block={story.content} />;
}
```

To enable live editing in the Visual Editor, wrap the rendered content in
[`StoryblokPreview`](#storyblokpreview).

## API

`@storyblok/react` exports the following components, hooks, and helpers.

### `defineStoryblokBlocks`

`defineStoryblokBlocks()` maps Storyblok blocks to React components and returns the `StoryblokBlock`
and `StoryblokRichText` components, which share the same component map.

```js
import { defineStoryblokBlocks } from "@storyblok/react";

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => OPTIONS);
```

`defineStoryblokBlocks()` accepts a function that returns the options. The function runs on the
first render, not when the module loads. Until the function returns a valid component map, each
render calls the function again, so keep the function free of side effects.

The options accept the following properties:

| Key                | Description                                                                                                                                                                                                                                               | Type                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `components`       | An object that maps the technical names of Storyblok blocks to React components or to a component configuration. Each component receives a `block` prop containing the content of the block, and an `editable` prop.                                      | `Record<string, StoryblokBlockEntry>` |
| `fallback`         | A component to render when a block has no registered component. The fallback receives the same `block` and `editable` props.                                                                                                                              | React component                       |
| `suspenseFallback` | The default element to show while an asynchronous or lazy component loads, for example, `<Skeleton />`.                                                                                                                                                   | React element                         |
| `warnings`         | Whether to log a warning when `StoryblokBlock` renders nothing: for an undefined `block`, a block without a registered component or `fallback`, or an entry that isn’t a React component. Each warning prints once per component map. Defaults to `true`. | `boolean`                             |

If a block has no registered component and the options don’t include a `fallback`, `StoryblokBlock`
renders nothing and logs a `No component registered for block type "<block-name>"` warning.

If an entry in `components` isn’t a React component, for example, a module namespace from
`import * as Teaser`, `StoryblokBlock` logs a warning and renders blocks of that type with the
`fallback`, or renders nothing. Blocks of other types render normally.

#### Component configuration

Instead of a component, an entry in `components` can be a configuration object that controls the
Suspense behavior of that component. This configuration is especially useful for asynchronous Server
Components that fetch their own data.

```jsx
export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => ({
  components: {
    hero: {
      component: Hero,
      fallback: <HeroSkeleton />,
      suspense: true,
    },
    article: Article,
  },
  suspenseFallback: <Skeleton />,
}));
```

| Key         | Description                                                                                                                      | Type            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `component` | The React component that renders the block. Required.                                                                            | React component |
| `fallback`  | The element to show while this component loads. Overrides `suspenseFallback`.                                                    | React element   |
| `suspense`  | Whether to wrap the component in a Suspense boundary. `StoryblokBlock` wraps components created with `React.lazy` automatically. | `boolean`       |

### `StoryblokBlock`

`StoryblokBlock` is a React component that dynamically renders a single block from Storyblok.
`defineStoryblokBlocks` returns it.

`StoryblokBlock` accepts a `block` prop, which should be a block from the Storyblok API.
`StoryblokBlock` passes any other props directly to the block component.

```jsx
<StoryblokBlock block={block} />
```

When `block` is `undefined`, for example, `story?.content` after a failed fetch, `StoryblokBlock`
renders nothing and logs a warning outside the Visual Editor.

### `StoryblokPreview`

`StoryblokPreview` is a React component that enables live editing in the Visual Editor. The
component receives the fetched story and a `renderContent` function, and calls `renderContent` again
with the updated story on every change in the Visual Editor.

Outside the Visual Editor, `StoryblokPreview` doesn’t load the Storyblok Bridge and renders the
content once.

`StoryblokPreview` provides two entry points depending on the application architecture: one for
client-rendered applications and one for server-rendered applications that use React Server
Components.

#### Client-rendered applications

For client-rendered applications, import `StoryblokPreview` from `@storyblok/react`:

```jsx
import { StoryblokPreview } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

<StoryblokPreview
  story={story}
  renderContent={(live) => <StoryblokBlock block={live.content} />}
/>;
```

The `renderContent` function receives the live story and returns the React content to render.

#### Server-rendered applications

For applications that use React Server Components, import `StoryblokPreview` from
`@storyblok/react/rsc`. In this entry point, `StoryblokPreview` is an asynchronous Server Component,
and `renderContent` must be a Server Action. This entry point requires React 19.

Define the Server Action in a separate file:

```jsx
// src/lib/actions.js
"use server";

import { StoryblokBlock } from "@/lib/storyblok";

export async function renderContent(story) {
  return <StoryblokBlock block={story.content} />;
}
```

Then pass the Server Action to `StoryblokPreview`:

```jsx
// src/app/page.js
import { notFound } from "next/navigation";
import { StoryblokPreview } from "@storyblok/react/rsc";
import { renderContent } from "@/lib/actions";
import { apiClient } from "@/lib/storyblok";

export default async function Home() {
  const { data } = await apiClient.stories.get("home", {
    query: { version: "draft" },
  });

  if (!data?.story) {
    notFound();
  }

  return <StoryblokPreview story={data.story} renderContent={renderContent} />;
}
```

`StoryblokPreview` renders the initial content on the server. In the Visual Editor, the component
calls the Server Action on every change and streams the result in, keeping the current content on
screen until the update arrives. `StoryblokPreview` runs one Server Action at a time. If the Server
Action fails, `StoryblokPreview` logs the error and keeps the last successfully rendered content
visible.

While the Visual Editor shows a previous version of the story, it sends the story without content.
`StoryblokPreview` ignores these changes and keeps the current content. When the `story` prop
changes to a different story, for example, in a shared layout, the live preview starts over with the
new story.

`renderContent` is a public Server Action: it’s reachable in production and renders any story it
receives. If a registered component uses block fields for privileged requests, such as a preview
token or a URL taken from the block, treat the story as untrusted input, or check that draft mode is
enabled.

#### Props

| Key             | Description                                                                                                                                                                                                                                                                                                                          | Type       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `story`         | The story fetched from the Storyblok API. Required.                                                                                                                                                                                                                                                                                  | `Story`    |
| `renderContent` | A function that receives the live story and returns the content to render. In `@storyblok/react/rsc`, it must be an asynchronous Server Action. Required.                                                                                                                                                                            | `function` |
| `bridgeOptions` | Options for the Storyblok Bridge, such as `resolveRelations`. `StoryblokPreview` reads them once, when it mounts. Learn more in the [@storyblok/preview-bridge reference](https://www.storyblok.com/docs/libraries/js/preview-bridge). In `@storyblok/react`, also accepts [`onChange` and `onError`](#saved-and-published-changes). | `object`   |
| `debounceMs`    | Milliseconds to wait after the last change in the Visual Editor before updating the content. In `@storyblok/react/rsc`, the default is `200`; otherwise, updates are immediate.                                                                                                                                                      | `number`   |

When fetching a story with the `resolve_relations` parameter, also pass the same relations as
`bridgeOptions.resolveRelations`, so the relations stay resolved after a live update. Enable
`inlineRelations` in the
[API client](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client) to inline the
resolved stories into the content.

`StoryblokPreview` ignores changes to other stories, so a page and, for example, a navigation story
can each use their own `StoryblokPreview` on the same page.

#### Saved and published changes

By default, saving or publishing the story in the Visual Editor reloads the page. In
`@storyblok/react`, pass `bridgeOptions.onChange` to replace the reload, for example, to refetch
data with `router.refresh()` in Next.js:

```jsx
<StoryblokPreview
  story={story}
  bridgeOptions={{ onChange: () => router.refresh() }}
  renderContent={(live) => <StoryblokBlock block={live.content} />}
/>
```

The page still reloads unless every live preview subscription on the page passes `onChange`. To
handle failures to load the Storyblok Bridge, pass `bridgeOptions.onError`. By default,
`StoryblokPreview` logs the error with `console.error`.

In `@storyblok/react/rsc`, `bridgeOptions` doesn’t accept `onChange` or `onError`, because a Server
Component can’t pass functions to a Client Component.

### `useStoryblokState`

`useStoryblokState()` accepts a story from the Storyblok API and makes the story reactive for live
editing. The hook returns the latest version of the story on every change in the Visual Editor.
`StoryblokPreview` from `@storyblok/react` uses this hook internally.

Use `StoryblokPreview` to wrap the rendered content of a story. Use `useStoryblokState()` when other
parts of the component also depend on the live story, for example, to update the page title while
editing.

```jsx
import { useStoryblokState } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

export default function Home({ story: STORY_OBJECT }) {
  const story = useStoryblokState(STORY_OBJECT, OPTIONS);

  return <StoryblokBlock block={story.content} />;
}
```

`OPTIONS` accepts the same `bridgeOptions` and `debounceMs` options as [`StoryblokPreview`](#props).

### `useStoryblokEditorEvent`

`useStoryblokEditorEvent()` subscribes to changes in the Visual Editor and calls a function with the
updated story, without keeping the story in state. Use the hook to react to changes in a custom way,
for example, to update data held by another state manager.

```jsx
import { useStoryblokEditorEvent } from "@storyblok/react";

useStoryblokEditorEvent((story) => {
  // ...
}, OPTIONS);
```

`OPTIONS` accepts the same `bridgeOptions` and `debounceMs` options as [`StoryblokPreview`](#props).

### `storyblokEditable`

Every component rendered through `StoryblokBlock` receives an `editable` prop. Spread `editable`
onto the root element of the component to make the component editable in the Visual Editor.

```jsx
export default function Feature({ block, editable }) {
  return <section {...editable}>{block.title}</section>;
}
```

For components that aren’t rendered through `StoryblokBlock`, use `storyblokEditable()` instead.
`storyblokEditable()` accepts a block from the Storyblok API and returns an object containing the
same HTML attributes.

```jsx
import { storyblokEditable } from "@storyblok/react";

export default function Feature({ block }) {
  return <section {...storyblokEditable(block)}>{block.title}</section>;
}
```

### `StoryblokRichText`

`StoryblokRichText` renders a rich text field from a Storyblok story. Use the `StoryblokRichText`
component returned by `defineStoryblokBlocks`, so that blocks embedded in the rich text field render
through the registered components. The component works in both Server Components and Client
Components.

```jsx
import { StoryblokRichText } from "@/lib/storyblok";

<StoryblokRichText document={block.richtext_field} />;
```

The component accepts the following optional props:

- `components` sets custom React components for supported rich text nodes and marks.
- `optimizeImage` sets [image optimization](https://www.storyblok.com/docs/api/image-service)
  options for image nodes: `true` for the defaults, or any subset of the options, for example,
  `{ width: 800 }`.
- `data` shares custom data with all custom rich text components. Each component receives the data
  as `context.data`.
- `warnings` set to `false` silences the warnings for embedded blocks that render nothing. Defaults
  to `true`.

If `data` is a plain object, `StoryblokRichText` also passes it to every embedded block as extra
props, like the extra props of `StoryblokBlock`. TypeScript doesn’t check `data` against the extra
props of the component map. To check it, use `satisfies`, for example,
`data={{ locale } satisfies ExtraProps}`.

A custom component for the `blok` node replaces the component map for embedded blocks.

To render rich text without the component map, use the standalone
[`createRichTextRenderer`](#createrichtextrenderer) function. The function renders embedded blocks
only when its `components` option includes a custom component for the `blok` node, the rich text
node that holds embedded blocks.

When using TypeScript, custom components are fully type-safe through the
`StoryblokReactRichTextProps<T>` utility type. For example, `StoryblokReactRichTextProps<"link">`
provides the attributes and `children` available for the `link` mark, while
`StoryblokReactRichTextProps<"heading">` provides access to heading-specific attributes such as
`level`.

Find the supported rich text nodes and marks, and the customization options, in the
[@storyblok/richtext reference](https://www.storyblok.com/docs/libraries/js/rich-text).

#### Custom components

To register custom components, use the `components` prop. The key must match a supported rich text
node or mark name.

```tsx
import type { StoryblokReactRichTextComponentMap } from "@storyblok/react";

const components: StoryblokReactRichTextComponentMap = {
  heading: CustomHeading,
  link: CustomLink,
  table: CustomTable,
  bold: ({ children }) => <b className="font-bold text-black">{children}</b>,
};
```

Then pass the components to `StoryblokRichText`:

```tsx
<StoryblokRichText document={block.richtext_field} components={components} />
```

The rendered output is recomputed whenever `components` or `data` change by reference. Define
`components` and `data` outside the component, or wrap them in `useMemo`, instead of passing inline
objects.

#### Example: custom link component (mark)

Marks receive their rendered child content through the `children` prop.

```tsx
import type { StoryblokReactRichTextProps } from "@storyblok/react";
import Link from "next/link";

export function CustomLink({ children, attrs }: StoryblokReactRichTextProps<"link">) {
  return (
    <Link href={attrs?.href ?? ""} target={attrs?.target ?? "_self"}>
      {children}
    </Link>
  );
}
```

#### Example: custom heading component (node)

Nodes can use the `children` prop to render child content.

```tsx
import type { StoryblokReactRichTextProps } from "@storyblok/react";

export function CustomHeading({ children, attrs }: StoryblokReactRichTextProps<"heading">) {
  const Tag = `h${attrs?.level ?? 1}` as keyof JSX.IntrinsicElements;

  return <Tag className="custom-heading">{children}</Tag>;
}
```

#### Example: custom table component (advanced node)

For advanced use cases, nodes can access `content` and `context` to recursively render child nodes
using `StoryblokRichText`.

To render semantic table nodes, use the `splitTableRows` utility from `@storyblok/richtext` and
create `<thead>` and `<tbody>` elements.

```tsx
import type { StoryblokReactRichTextProps } from "@storyblok/react";
import { StoryblokRichText } from "@/lib/storyblok";
import { splitTableRows } from "@storyblok/richtext";

export function CustomTable({ content, context }: StoryblokReactRichTextProps<"table">) {
  const { headerRows, bodyRows } = splitTableRows(content);

  return (
    <table className="custom-table">
      {headerRows.length > 0 && (
        <thead>
          <StoryblokRichText document={headerRows} {...context} />
        </thead>
      )}

      <tbody>
        <StoryblokRichText document={bodyRows} {...context} />
      </tbody>
    </table>
  );
}
```

Spreading `context` passes the custom components, image options, and data of the parent on to the
nested rows, including the renderer for embedded blocks.

### `createRichTextRenderer`

`createRichTextRenderer()` returns a function that renders a rich text document to React elements.
Use `createRichTextRenderer()` to render rich text outside of JSX.

```jsx
import { createRichTextRenderer } from "@storyblok/react";

const render = createRichTextRenderer({ components, optimizeImage: true });

const content = render(block.richtext_field);
```

`createRichTextRenderer()` accepts the same `components`, `optimizeImage`, `data`, and `warnings`
options as `StoryblokRichText`. To render embedded blocks, provide a custom component for the `blok`
rich text node. Without one, the function skips embedded blocks and logs a warning.

### `editableField`

`editableField()` accepts a field name and returns the HTML attribute that makes that single field
selectable in the Visual Editor. For an empty field name, it returns an empty object.

```jsx
import { editableField } from "@storyblok/react";

<h1 {...editableField("headline")}>{block.headline}</h1>;
```

### `isInEditor`

`isInEditor()` accepts a URL and returns whether the URL is a Visual Editor request. To also require
the request to come from a specific space, pass the `spaceId` option.

```js
import { isInEditor } from "@storyblok/react";

const inEditor = isInEditor(new URL(window.location.href), { spaceId: "SPACE_ID" });
```

### TypeScript

`@storyblok/react` exports types for stories and blocks. Use `StoryblokBlockComponentProps` to type
the props of a block component:

```tsx
import type { StoryblokBlockData, StoryblokBlockComponentProps } from "@storyblok/react";

type PageProps = StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }>;

export default function Page({ block, editable }: PageProps) {
  // ...
}
```

To pass extra props through `StoryblokBlock` in TypeScript, declare the extra props as a type
argument of `defineStoryblokBlocks`, for example,
`defineStoryblokBlocks<{ locale: string }>(() => OPTIONS)`. Then pass the same props as the second
type argument of `StoryblokBlockComponentProps`, for example,
`StoryblokBlockComponentProps<{ title: string }, { locale: string }>`. A required extra prop must be
passed to every `StoryblokBlock`, including nested ones. `block` and `editable` are reserved and
can’t be extra props.

To narrow `story.content` to the blocks of a project, use the `withTypes()` method of the API
client. Learn more in the
[`@storyblok/api-client` reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#typescript).

## Further resources

- [Migrate to @storyblok/react 8.x](https://www.storyblok.com/docs/libraries/js/react-sdk/migration-from-v7)—Learn
  how to upgrade an application from version 7.x in the migration guide.
- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn
  how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
- [@storyblok/richtext Package Reference](https://www.storyblok.com/docs/libraries/js/rich-text)—Find
  the supported rich text nodes, marks, and customization options in the @storyblok/richtext
  reference.
- [@storyblok/schema Package Reference](https://www.storyblok.com/docs/libraries/js/schema)—Learn
  how to type the blocks of a project in the @storyblok/schema reference.
- [@storyblok/live-preview Package Reference](https://github.com/storyblok/monoblok/blob/main/packages/live-preview/docs/reference.md)—Learn
  how live preview subscriptions share the Storyblok Bridge in the @storyblok/live-preview
  reference.
- [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor)—Learn how live editing
  works in the Visual Editor concept.
- [Repository playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground)—Find
  additional examples in the React and Next.js playgrounds.
