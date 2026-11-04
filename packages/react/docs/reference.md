---
title: "@storyblok/react"
description: "@storyblok/react is Storyblok’s official SDK for React applications."
---

# @storyblok/react

[@storyblok/react](https://github.com/storyblok/monoblok/tree/main/packages/react) is Storyblok’s official SDK for React applications.

Version 8.x separates rendering from data fetching. Fetch content with [`@storyblok/api-client`](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client), and render it with the components returned by [`defineStoryblokBlocks`](#definestoryblokblocks).

## Requirements

- **React** version 18 or later (version 19 for React Server Components)
- **Node.js** LTS (version 22.x recommended)
- **Evergreen web browser** (for example, Chrome, Firefox, Safari, or Edge)

## Installation

Add the SDK and the Storyblok API client to a project by running this command in the terminal:

```bash
npm install @storyblok/react@rc @storyblok/api-client
```

## Usage

How to configure the SDK, register components, and render stories. The SDK provides two entry points for different rendering modes:

| Export                 | When to use                                                                                               | How to use                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@storyblok/react`     | All environments: client-rendered and single-page apps, static export, and Server Components.             | Use **`defineStoryblokBlocks`** to render content. Use **`StoryblokPreview`** or **`useStoryblokState`** for live editing in client-rendered apps.                        |
| `@storyblok/react/rsc` | Next.js App Router and other React Server Components (RSC) setups that support Server Actions (React 19). | Use **`StoryblokPreview`** for live editing. Its `renderContent` prop is a Server Action, so the content re-renders on the server with every change in the Visual Editor. |

### Configuration

Create an [`@storyblok/api-client`](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client) instance with the space’s [access token](https://www.storyblok.com/docs/concepts/access-tokens), and register the React components that render each block.

```jsx title="src/lib/storyblok.js" wrap
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock, StoryblokBlocks, StoryblokRichText } = defineStoryblokBlocks({
  components: {
    page: Page,
    teaser: Teaser,
  },
});
```

> [!WARNING]
> The `region` parameter is required for non-EU spaces. For details, refer to the [`@storyblok/api-client` reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#region).

### Components

Create a React component for each block defined in Storyblok and registered in the configuration. Each component receives a `block` prop that contains the block’s content, and an `editable` prop.

```jsx title="src/components/Teaser.jsx" wrap
export default function Teaser({ block, editable }) {
  return (
    <div {...editable}>
      <h2>{block.headline}</h2>
    </div>
  );
}
```

To automatically render nested blocks, use `StoryblokBlocks`, which renders each block of an array through the registered components.

```jsx title="src/components/Page.jsx" wrap
import { StoryblokBlocks } from "@/lib/storyblok";

export default function Page({ block, editable }) {
  return <main {...editable}>{block.body && <StoryblokBlocks blocks={block.body} />}</main>;
}
```

### Fetching and rendering

Use the API client to fetch a story and render its content with `StoryblokBlock`.

In a React Server Component, fetch the story directly:

```jsx title="src/app/page.js" wrap
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

In a client-rendered application, use a data-fetching library such as [SWR](https://swr.vercel.app/docs/getting-started) or [React Query](https://tanstack.com/query/latest/docs/framework/react/overview) alongside the API client. These libraries handle loading and error states, and cache the fetched stories:

```jsx title="src/App.jsx" wrap
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

To enable live editing in the Visual Editor, wrap the rendered content in [`StoryblokPreview`](#storyblokpreview-client).

### Live editing

`StoryblokPreview` is a React component that enables live editing in the Visual Editor. The component receives the fetched story and a `renderContent` function, and calls `renderContent` again with the updated story on every change in the Visual Editor.

Outside the Visual Editor, `StoryblokPreview` doesn’t load the Storyblok Bridge and renders the content once.

`StoryblokPreview` provides two entry points depending on the application architecture: one for client-rendered applications and one for server-rendered applications that use React Server Components.

#### Client-rendered applications

For client-rendered applications, import `StoryblokPreview` from `@storyblok/react`:

```jsx wrap
import { StoryblokPreview } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

<StoryblokPreview
  story={story}
  renderContent={(live) => <StoryblokBlock block={live.content} />}
/>;
```

The `renderContent` function receives the live story and returns the React content to render.

#### Server-rendered applications

For applications that use React Server Components, import `StoryblokPreview` from `@storyblok/react/rsc`. In this entry point, `StoryblokPreview` is an asynchronous Server Component, and `renderContent` must be a Server Action. This entry point requires React 19.

Define the Server Action in a separate file:

```jsx title="src/lib/actions.js" wrap
"use server";

import { StoryblokBlock } from "@/lib/storyblok";

export async function renderContent(story) {
  return <StoryblokBlock block={story.content} />;
}
```

Then pass the Server Action to `StoryblokPreview`:

```jsx title="src/app/page.js" wrap
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

`StoryblokPreview` renders the initial content on the server. In the Visual Editor, the component calls the Server Action on every change and streams the result in, keeping the current content on screen until the update arrives. If the Server Action fails, `StoryblokPreview` logs the error and keeps the initially rendered content visible.

### Rich text

`StoryblokRichText` renders a rich text field from a Storyblok story. Use the `StoryblokRichText` component returned by `defineStoryblokBlocks`, so that blocks embedded in the rich text field render through the registered components. The component works in both Server Components and Client Components.

```jsx wrap
import { StoryblokRichText } from "@/lib/storyblok";

<StoryblokRichText document={block.richtext_field} />;
```

The component accepts the following optional props:

- `components` sets custom React components for supported rich text nodes and marks.
- `optimizeImage` sets [image optimization](https://www.storyblok.com/docs/api/image-service) options for image nodes.
- `data` shares custom data with all custom rich text components. Each component receives the data as `context.data`.

To render rich text without the component map, use the standalone [`createRichTextRenderer`](#createrichtextrenderer) function. The function renders embedded blocks only when its `components` option includes a custom component for the `blok` node, the rich text node that holds embedded blocks.

When using TypeScript, custom components are fully type-safe through the `StoryblokReactRichTextProps<T>` utility type. For example, `StoryblokReactRichTextProps<"link">` provides the attributes and `children` available for the `link` mark, while `StoryblokReactRichTextProps<"heading">` provides access to heading-specific attributes such as `level`.

Find the supported rich text nodes and marks, and the customization options, in the [@storyblok/richtext reference](https://www.storyblok.com/docs/libraries/js/rich-text).

#### Custom components

To register custom components, use the `components` prop. The key must match a supported rich text node or mark name.

```tsx wrap
import type { StoryblokReactRichTextComponentMap } from "@storyblok/react";

const components: StoryblokReactRichTextComponentMap = {
  heading: CustomHeading,
  link: CustomLink,
  table: CustomTable,
  bold: ({ children }) => <b className="font-bold text-black">{children}</b>,
};
```

Then pass the components to `StoryblokRichText`:

```tsx wrap
<StoryblokRichText document={block.richtext_field} components={components} />
```

> [!WARNING]
> The rendered output is recomputed whenever `components` or `data` change by reference. Define `components` and `data` outside the component, or wrap them in `useMemo`, instead of passing inline objects.

#### Example: render links with a custom component

Marks receive their rendered child content through the `children` prop.

```tsx wrap
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

#### Example: render headings with a custom component

Nodes can use the `children` prop to render child content.

```tsx wrap
import type { StoryblokReactRichTextProps } from "@storyblok/react";

export function CustomHeading({ children, attrs }: StoryblokReactRichTextProps<"heading">) {
  const Tag = `h${attrs?.level ?? 1}` as keyof JSX.IntrinsicElements;

  return <Tag className="custom-heading">{children}</Tag>;
}
```

#### Example: render tables with semantic markup

For advanced use cases, nodes can access `content` and `context` to recursively render child nodes using `StoryblokRichText`.

To render semantic table nodes, use the `splitTableRows` utility from `@storyblok/richtext` and create `<thead>` and `<tbody>` elements.

```tsx wrap
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

Spreading `context` passes the custom components, image options, and data of the parent on to the nested rows, including the renderer for embedded blocks.

## TypeScript

`@storyblok/react` exports types for stories and blocks. Use `StoryblokBlockComponentProps` to type the props of a block component:

```tsx wrap
import type { StoryblokBlockData, StoryblokBlockComponentProps } from "@storyblok/react";

type PageProps = StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }>;

export default function Page({ block, editable }: PageProps) {
  // ...
}
```

To pass extra props through `StoryblokBlock` and `StoryblokBlocks` in TypeScript, declare the extra props as a type argument of `defineStoryblokBlocks`, for example, `defineStoryblokBlocks<{ locale: string }>(OPTIONS)`. Then pass the same props as the second type argument of `StoryblokBlockComponentProps`, for example, `StoryblokBlockComponentProps<{ title: string }, { locale: string }>`.

To narrow `story.content` to the blocks of a project, use the `withTypes()` method of the API client. Learn more in the [`@storyblok/api-client` reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#typescript).

## API

`@storyblok/react` exports the following functions and components.

| Export                                                | Description                                                                                                                                 | Import from                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [`defineStoryblokBlocks`](#definestoryblokblocks)     | Maps Storyblok block types to React components and returns pre-wired `StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText`.          | `@storyblok/react`                         |
| [`StoryblokPreview`](#storyblokpreview-client)        | Client component that subscribes to Storyblok Visual Editor events and re-renders its content with the latest story on every editor update. | `@storyblok/react`, `@storyblok/react/rsc` |
| [`useStoryblokState`](#usestoryblokstate)             | Subscribes to Storyblok Visual Editor events and returns the latest story.                                                                  | `@storyblok/react`                         |
| [`useStoryblokEditorEvent`](#usestoryblokeditorevent) | Subscribes to Storyblok Visual Editor events and calls `callback` with the updated story.                                                   | `@storyblok/react`                         |
| [`storyblokEditable`](#storyblokeditable)             | Returns the attributes that make an element editable in the Visual Editor.                                                                  | `@storyblok/react`                         |
| [`createRichTextRenderer`](#createrichtextrenderer)   | Returns a render function for a Storyblok rich text document.                                                                               | `@storyblok/react`                         |

## Blocks

Register React components for Storyblok blocks and render blocks with them.

### `defineStoryblokBlocks`

Maps Storyblok block types to React components and returns pre-wired
`StoryblokBlock`, `StoryblokBlocks`, and `StoryblokRichText`.

Pass `TExtraProps` as an explicit type argument to type the extra props
`StoryblokBlock`/`StoryblokBlocks` forward to every rendered block
component, with real excess-property checking on every call site. Without
it, they only accept `block`/`blocks`.

Import from `@storyblok/react`.

```tsx
function defineStoryblokBlocks(config: StoryblokBlocksOptions): StoryblokBlocksResult<TExtraProps>;
```

`defineStoryblokBlocks()` accepts a `config` object with the following properties:

| Key                | Description                                                                                                                                                                                              | Type                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `components`       | Maps the technical names of Storyblok blocks to React components or to a component configuration. Each component receives a `block` prop with the content of the block and an `editable` prop. Required. | `Record<string, StoryblokBlockEntry>` |
| `fallback`         | Fallback component when a block type isn’t found                                                                                                                                                         | `AnyBlockComponent`                   |
| `suspenseFallback` | Default Suspense fallback for async components (`<GlobalSkeleton />`).                                                                                                                                   | `ReactNode`                           |

`defineStoryblokBlocks()` returns `StoryblokBlocksResult<TExtraProps>`, an object with the following properties:

| Key                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Type                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `StoryblokBlock`    | Renders a single block by looking up `block.component` in the map. `TExtraProps` comes from the type argument passed to [`defineStoryblokBlocks`](#definestoryblokblocks), not from this call site, so it forwards extra props to every rendered block component with real excess-property checking: a misspelled prop (`titlee="typo"`) is a compile error instead of silently forwarding. Without a type argument, `TExtraProps` defaults to `{}` and `StoryblokBlock` only accepts `block`. Required. | `(props: { block: StoryblokBlockData } & TExtraProps) => ReactNode`    |
| `StoryblokBlocks`   | Renders an array of blocks, delegating each entry to `StoryblokBlock`. Convenience over mapping manually: `key` is derived from `block._uid` and every entry receives the same `TExtraProps`. Required.                                                                                                                                                                                                                                                                                                  | `(props: { blocks: StoryblokBlockData[] } & TExtraProps) => ReactNode` |
| `StoryblokRichText` | Renders a rich text document, resolving embedded blocks via the same component map. Required.                                                                                                                                                                                                                                                                                                                                                                                                            | `(options: StoryblokReactRichTextComponentProps) => ReactNode`         |

#### Example

```tsx
export const { StoryblokBlock, StoryblokBlocks, StoryblokRichText } = defineStoryblokBlocks<{
  locale: string;
}>({
  components: {
    page: Page,
    teaser: Teaser,
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true,
    },
  },
  fallback: FallbackBlock,
  suspenseFallback: <GlobalSkeleton />,
});
```

Related types:

| Type                  | Description                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `StoryblokBlockEntry` | A component entry in the Storyblok component map. Can be either a plain component or a config object with Suspense options. |

## Live editing

Update content in real time while editors change it in the Visual Editor.

### `StoryblokPreview` (client)

Import from `@storyblok/react`.

Client component that subscribes to Storyblok Visual Editor events and
re-renders its content with the latest story on every editor update.

Pass the initially fetched story and a `renderContent` function. The
component holds the live story in state and calls `renderContent` with it
on every editor update, so your UI stays in sync with the Visual Editor
without a full page reload.

For RSC routes driven by a Server Action, use `StoryblokPreview` from
`@storyblok/react/rsc` instead—same props shape (`story` +
`renderContent`), but `renderContent` there is `async` and reruns on the
server.

```tsx
function StoryblokPreview(options: StoryblokPreviewProps<TStory>): ReactNode;
```

#### Props

| Key             | Description                                                                                                                                     | Type                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `story`         | Initial story fetched by the application. Required.                                                                                             | `TStory`                                                                                         |
| `renderContent` | Render function that receives the latest story on every Visual Editor update and returns the UI for it. Required.                               | `(story: { id: TStory["id"]; uuid?: TStory["uuid"]; content?: TStory["content"] }) => ReactNode` |
| `debounceMs`    | Milliseconds to wait after the last editor event before invoking the callback. When omitted the callback is invoked immediately on every event. | `number`                                                                                         |
| `bridgeOptions` | Configuration forwarded to the Preview Bridge constructor. Captured at mount time—changes after mount have no effect.                           | `BridgeParams`                                                                                   |

#### Example

```tsx
<StoryblokPreview
  story={story}
  renderContent={(live) => (live.content ? <StoryblokBlock block={live.content} /> : null)}
/>
```

### `StoryblokPreview` (server)

Import from `@storyblok/react/rsc`.

Server Component that enables live preview for RSC routes.

Awaits `renderContent(story)` once to produce the initial server-rendered
output, then hands off to a client-side runtime that re-invokes
`renderContent`—a Server Action—on every Storyblok Visual Editor
update, streaming the result in via Suspense while keeping the current
tree on screen (no full page reload, no duplicate-DOM flash).

Same props shape as `StoryblokPreview` from `@storyblok/react`
(`story` + `renderContent`)—the only difference is that `renderContent`
here is `async` and reruns on the server. Requires React 19 (`React.use`)
and Server Actions; use `@storyblok/react` on React 18 or with
`output: 'export'`.

```tsx
function StoryblokPreview(options: StoryblokPreviewProps<TStory>): Promise<ReactNode>;
```

#### Props

| Key             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Type                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `story`         | Initial story fetched by the application. Required.                                                                                                                                                                                                                                                                                                                                                                                                                   | `TStory`                                                                                                  |
| `renderContent` | Server Action responsible for rendering the story. Called once, awaited, for the initial render, and again on every subsequent Visual Editor update. This is a public Server Action: it’s reachable in production and renders whatever story the caller sends. Validate `story` like any user input, or gate access behind draft mode, if a registered component uses block fields for privileged fetches (a preview token, or a URL taken from the block). Required. | `(story: { id: TStory["id"]; uuid?: TStory["uuid"]; content?: TStory["content"] }) => Promise<ReactNode>` |
| `debounceMs`    | Milliseconds to wait after the last editor event before triggering a re-render. Prevents a Server Action call on every individual keystroke. Defaults to 200 ms.                                                                                                                                                                                                                                                                                                      | `number`                                                                                                  |
| `bridgeOptions` | Configuration forwarded to the Preview Bridge constructor. Captured at mount time—changes after mount have no effect.                                                                                                                                                                                                                                                                                                                                                 | `BridgeParams`                                                                                            |

#### Example

```tsx
// app/[slug]/page.tsx (Server Component)
export default async function Page({ params }) {
  const story = await fetchStory(params.slug);
  return <StoryblokPreview story={story} renderContent={renderStory} />;
}
```

### `useStoryblokState`

Subscribes to Storyblok Visual Editor events and returns the latest story.

Pass the initially fetched story (from your server component, route loader,
or data-fetching hook). On every editor update the returned value is replaced
with the updated story—triggering a re-render of the calling component.

Use `StoryblokPreview` to wrap the rendered content of a story. Use
`useStoryblokState()` when other parts of the component also depend on the
live story, for example, to update the page title while editing.

Import from `@storyblok/react`.

```tsx
function useStoryblokState(
  story: TStory,
  options?: UseStoryblokStateOptions,
): { id: TStory["id"]; uuid?: TStory["uuid"]; content?: TStory["content"] };
```

`useStoryblokState()` accepts the following parameters:

| Key       | Description                                         | Type                       |
| --------- | --------------------------------------------------- | -------------------------- |
| `story`   | The story fetched from the Storyblok API. Required. | `TStory`                   |
| `options` | Defaults to `{}`.                                   | `UseStoryblokStateOptions` |

The `options` object accepts the following properties:

| Key             | Description                                                                                                                                     | Type           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `debounceMs`    | Milliseconds to wait after the last editor event before invoking the callback. When omitted the callback is invoked immediately on every event. | `number`       |
| `bridgeOptions` | Configuration forwarded to the Preview Bridge constructor. Captured at mount time—changes after mount have no effect.                           | `BridgeParams` |

`useStoryblokState()` returns `{ id: TStory["id"]; uuid?: TStory["uuid"]; content?: TStory["content"] }`.

#### Example

```tsx
"use client";
function Page({ story }: { story: Story }) {
  const live = useStoryblokState(story);
  return live.content ? <StoryblokBlock block={live.content} /> : null;
}
```

### `useStoryblokEditorEvent`

Subscribes to Storyblok Visual Editor events and calls `callback` with the
updated story. Handles async setup, the mounted guard, an optional delay,
and unsubscribes when the component is removed.

Both `callback` and `options.debounceMs` are tracked via refs so the
subscription is established once on mount and never torn down/re-created
unless the component is removed.

Each call establishes its own bridge subscription. Sharing one bridge per
options key across instances is tracked in
https://github.com/storyblok/monoblok/pull/794.

Import from `@storyblok/react`.

```tsx
function useStoryblokEditorEvent(
  callback: (story: {
    id: TStory["id"];
    uuid?: TStory["uuid"];
    content?: TStory["content"];
  }) => void,
  options?: UseStoryblokEditorEventOptions,
): void;
```

`useStoryblokEditorEvent()` accepts the following parameters:

| Key        | Description                                                            | Type                                                                                        |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `callback` | Called with the updated story on every Visual Editor change. Required. | `(story: { id: TStory["id"]; uuid?: TStory["uuid"]; content?: TStory["content"] }) => void` |
| `options`  | Defaults to `{}`.                                                      | `UseStoryblokEditorEventOptions`                                                            |

The `options` object accepts the following properties:

| Key             | Description                                                                                                                                     | Type           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `debounceMs`    | Milliseconds to wait after the last editor event before invoking the callback. When omitted the callback is invoked immediately on every event. | `number`       |
| `bridgeOptions` | Configuration forwarded to the Preview Bridge constructor. Captured at mount time—changes after mount have no effect.                           | `BridgeParams` |

#### Example

```tsx
"use client";
function Page({ story }: { story: Story }) {
  const [current, setCurrent] = useState(story);
  useStoryblokEditorEvent((updated) => setCurrent(updated));
  return <StoryblokBlock block={current.content} />;
}
```

### `storyblokEditable`

Returns the attributes that make an element editable in the Visual Editor.

Every component rendered through `StoryblokBlock` receives an `editable` prop.
Spread `editable` onto the root element of the component to make the component
editable in the Visual Editor.

```jsx
export default function Feature({ block, editable }) {
  return <section {...editable}>{block.title}</section>;
}
```

For components that aren’t rendered through `StoryblokBlock`, use
`storyblokEditable()` instead. It accepts a block from the Storyblok API and
returns the same attributes.

Import from `@storyblok/react`.

```tsx
function storyblokEditable(block?: { _editable?: string }): StoryblokEditableProps;
```

`storyblokEditable()` accepts the following parameters:

| Key     | Description                                                                                 | Type                     |
| ------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| `block` | A block from the Storyblok API. Without `_editable`, the function returns empty attributes. | `{ _editable?: string }` |

`storyblokEditable()` returns `StoryblokEditableProps`, the `data-blok-c` and `data-blok-uid` attributes the Visual Editor uses to find the block.

#### Example

```jsx
import { storyblokEditable } from "@storyblok/react";

export default function Feature({ block }) {
  return <section {...storyblokEditable(block)}>{block.title}</section>;
}
```

Related types:

| Type                     | Description                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `StoryblokEditableProps` | Attributes returned by `storyblokEditable`—spread onto the root element of a block component to enable click-to-edit in the Visual Editor. |
| `LivePreviewStory`       | The story payload delivered by the Visual Editor `input` event.                                                                            |

## Rich text

Render rich text fields with custom React components for nodes and marks.

### `createRichTextRenderer`

Returns a render function for a Storyblok rich text document.
Prefer `<StoryblokRichText>` for typical use; use this when you need a plain function.

Import from `@storyblok/react`.

```tsx
function createRichTextRenderer(
  options: StoryblokReactRichTextRenderContext,
): (document: StoryblokRichTextInput) => ReactNode;
```

`createRichTextRenderer()` accepts an `options` object with the following properties:

| Key             | Description                                                                                                                | Type                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `optimizeImage` | [Image optimization](https://www.storyblok.com/docs/api/image-service) options for image nodes.                            | `boolean \| StoryblokRichTextImageOptions` |
| `components`    | Custom React components for rich text nodes and marks. To render embedded blocks, include a component for the `blok` node. | `StoryblokReactRichTextComponentMap`       |
| `data`          | Custom data shared with all custom rich text components. Each component receives it as `context.data`.                     | `unknown`                                  |

`createRichTextRenderer()` returns `(document: StoryblokRichTextInput) => ReactNode`.

#### Example

```tsx
const render = createRichTextRenderer({ optimizeImage: true });
return <div>{render(story.content.richtext)}</div>;
```

Related types:

| Type                                   | Description                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StoryblokReactRichTextComponentMap`   | Map of rich text element types to their custom React renderer components.                                                                                                    |
| `StoryblokReactRichTextComponent`      | A React component that renders a single rich text node or mark of type `T`.                                                                                                  |
| `StoryblokReactRichTextProps`          | Props for a custom React rich text node or mark component of type `T`. Replaces the string `children` of the core renderer with `ReactNode` and adds a React render context. |
| `StoryblokReactRichTextComponentProps` | Props for the `<StoryblokRichText>` React component.                                                                                                                         |
| `StoryblokRichTextDoc`                 | Canonical type for a Storyblok RichText JSON root. Learn more in the [@storyblok/richtext reference](https://www.storyblok.com/docs/libraries/js/rich-text).                 |

## Types

`@storyblok/react` exports the following types.

| Type                           | Description                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StoryblokBlockComponentProps` | Helper type for the props of a React component registered with [`defineStoryblokBlocks`](#definestoryblokblocks) and rendered via `StoryblokBlock`/`StoryblokBlocks`.                                                                                                                                                                                                                                              |
| `StoryblokBlockData`           | The loosely-typed shape of a block’s content: only `_uid`, `component`, and `_editable` are known, plus an index signature for every other field.                                                                                                                                                                                                                                                                  |
| `Story`                        | A Storyblok CDN (CAPI) story. Learn more in the [@storyblok/api-client reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#typescript).                                                                                                                                                                                                                                             |
| `BlockContent`                 | Content object for a single block instance as returned by the Storyblok Content Delivery API. Without a `TBlock` argument, this is the loose runtime shape (any block, `_editable` optional). With a schema-typed `TBlock`, fields are narrowed per the block’s `fields`. Learn more in the [@storyblok/api-client reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#typescript). |
| `BlockContentInput`            | Input variant of [`BlockContent`](#types) for write operations (creating/updating stories via the MAPI). `_uid` is optional. Learn more in the [@storyblok/api-client reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client#typescript).                                                                                                                                              |

## Further resources

- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
- [@storyblok/richtext Package Reference](https://www.storyblok.com/docs/libraries/js/rich-text)—Find the supported rich text nodes, marks, and customization options in the @storyblok/richtext reference.
- [@storyblok/schema Package Reference](https://www.storyblok.com/docs/libraries/js/schema)—Learn how to type the blocks of a project in the @storyblok/schema reference.
- [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor)—Learn how live editing works in the Visual Editor concept.
- [Repository Playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground)—Find additional examples in the repository playground.
- [React Guide](https://www.storyblok.com/docs/quickstarts/react)—Learn how to integrate Storyblok with React in the React guide.
- [Next.js Guide](https://www.storyblok.com/docs/quickstarts/nextjs)—Learn how to integrate Storyblok with Next.js in the Next.js guide.
