<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react" align="center">
  <img src="https://a.storyblok.com/f/88751/1776x360/ccc1c50c67/sb-react.png"  alt="Storyblok Logo">
  </a>
  <h1 align="center">@storyblok/react</h1>
  <p align="center">
    The React plugin you need to interact with <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react" target="_blank">Storyblok API</a> and enable the <a href="https://www.storyblok.com/docs/guide/essentials/visual-editor?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react" target="_blank">Real-time Visual Editing Experience</a>. This package helps you integrate Storyblok with React along with all types of React based frameworks like Next.js, Remix etc. This SDK includes support for React Server Components, static site generation, and Next.js static exports.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/react">
    <img src="https://img.shields.io/npm/v/@storyblok/react/latest.svg?style=flat-square" alt="Storyblok React" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/react" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/react.svg?style=flat-square" alt="npm">
  </a>
</p>

<p align="center">
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Kickstart a new project

Are you eager to dive into coding?
**[Follow these steps to kickstart a new project with Storyblok and React](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react#react)**,
and get started in just a few minutes!

## 5-minute Tutorial

Are you looking for a hands-on, step-by-step tutorial? The
**[React 5-minute Tutorial](https://www.storyblok.com/tp/headless-cms-react?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)**
has you covered! It provides comprehensive instructions on how to set up a Storyblok space and
connect it to your React project.

## Ultimate Tutorial

Are you looking for a hands-on, step-by-step tutorial? The
**[Next.js Ultimate Tutorial](https://www.storyblok.com/tp/nextjs-headless-cms-ultimate-tutorial?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)**
has you covered! It provides comprehensive instructions on building a complete, multilingual website
using Storyblok and Next.js from start to finish.

## Installation

Install `@storyblok/react`:

```bash
npm install @storyblok/react
// yarn add @storyblok/react
```

> ⚠️ This SDK uses the Fetch API under the hood. If your environment doesn't support it, you need to
> provide a polyfill. See the
> [API Client documentation](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)
> for details.

### From a CDN

Install the file from the CDN:

```html
<script src="https://unpkg.com/@storyblok/react"></script>
```

## Initialization

Set up the SDK in two steps: create the API client with your
[access token](https://www.storyblok.com/docs/api/content-delivery/v2/getting-started/authentication?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react),
then register your components with `defineStoryblokComponents`:

```ts
// lib/storyblok.ts
import { createApiClient, defineStoryblokComponents } from "@storyblok/react";

/** Import your components */
import Page from "./components/Page";
import Teaser from "./components/Teaser";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
  },
  // fallback: FallbackComponent,
  // suspenseFallback: LoadingSkeleton,
});
```

Add all your components to the `components` map in `defineStoryblokComponents`. The returned
`StoryblokComponent` renders any registered block by looking up `block.component` in that map.

That's it! All the features are enabled for you: the _API Client_ for interacting with the
[Storyblok CDN API](https://www.storyblok.com/docs/api/content-delivery/v2/getting-started/introduction?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react),
and the _Storyblok Bridge_ for the
[real-time visual editing experience](https://www.storyblok.com/docs/guide/essentials/visual-editor?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react).

## Region parameter

Possible values:

- `eu` (default): For spaces created in the EU
- `us`: For spaces created in the US
- `ap`: For spaces created in Australia
- `ca`: For spaces created in Canada
- `cn`: For spaces created in China

Full example for a space created in the US:

```ts
import { createApiClient, defineStoryblokComponents } from "@storyblok/react";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "us",
});

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {},
});
```

> Note: For spaces created in the United States or China, the `region` parameter **must** be
> specified.

`@storyblok/react` provides the following when initialized:

- `apiClient` — a typed API client for fetching content from the
  [Storyblok CDN API](https://www.storyblok.com/docs/api/content-delivery/v2/getting-started/introduction?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react).
- `StoryblokComponent` — renders any registered block component by matching `block.component` to the
  components map.
- `storyblokEditable` — attaches the required attributes to link a component to the Storyblok Visual
  Editor for
  [real-time visual updates](https://www.storyblok.com/docs/Guides/storyblok-latest-js?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react).

For every component you've defined in your Storyblok space, call `storyblokEditable` with the block
data and use `StoryblokComponentProps` to type your props:

```tsx
import type { StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

type FeatureProps = StoryblokComponentProps<{
  name: string;
  description: string;
}>;

const Feature = ({ block }: FeatureProps) => {
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="feature">
      <div>
        <div>{block.name}</div>
        <p>{block.description}</p>
      </div>
    </div>
  );
};

export default Feature;
```

Where `block` is the actual block data coming from
[Storyblok's Content Delivery API](https://www.storyblok.com/docs/api/content-delivery?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react).

> Note: The `storyblokEditable` function works the same way for all frameworks and components.

## Getting Started

**This SDK provides you the support to work with React and all React Frameworks such as Next.js,
Remix etc. Depending upon these different frameworks and versions, the way to use the SDK and the
functionalities it provides differ.**

Below is the guide and examples on how to use it with different frameworks -

### React

Initialize the SDK in your entry file (e.g. `main.tsx`) as described in the
[Initialization](#initialization) section above.

### Fetching Content and Listening to Storyblok Visual Editor events

Fetch content using `apiClient` and pass the story to `StoryblokPreview` for live editing. The
`StoryblokPreview` component is a client component that subscribes to Visual Editor events and calls
its render-prop children with the latest story on every update.

For data fetching we recommend a library such as [SWR](https://swr.vercel.app/) or
[TanStack Query](https://tanstack.com/query) to handle loading and error states. The example below
uses SWR:

```tsx
import { type Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import useSWR from "swr";
import { apiClient, StoryblokComponent } from "./lib/storyblok";

async function fetchStory(slug: string): Promise<Story> {
  const { data } = await apiClient.stories.get(slug, { query: { version: "draft" } });
  if (!data) throw new Error(`Story not found: ${slug}`);
  return data.story;
}

function App() {
  const { data: story, error } = useSWR("react", fetchStory);

  if (error) return <div>Failed to load story.</div>;
  if (!story) return <div>Loading...</div>;

  return (
    <StoryblokPreview story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}

export default App;
```

`StoryblokComponent` renders the block by matching `block.component` against the map registered in
`defineStoryblokComponents`. `StoryblokPreview` holds the live story in state and re-renders
children on every Visual Editor update.

To configure the bridge, pass a `bridgeOptions` prop to `StoryblokPreview`:

```tsx
<StoryblokPreview story={story} bridgeOptions={{ resolveRelations: ["article.author"] }}>
  {(live) => <StoryblokComponent block={live.content} />}
</StoryblokPreview>
```

You can also take a look at the
[React Playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground/react)
in this repo.

### Learn: Next.js 13 and 14 Data Fetching and Caching Behavior

When using Next.js 13 or 14 with the App Router, fetches are cached by default. To ensure you always
receive the latest content from Storyblok, opt out of caching at the route segment level:

```typescript
// app/[[...slug]]/page.tsx
export const dynamic = "force-dynamic";
```

For more details, refer to the Next.js documentation on
[opting out of caching](https://nextjs.org/docs/app/building-your-application/caching#opting-out-1).

> Note: In Next.js 15, this is no longer necessary — fetches are no longer cached by default based
> on [community feedback](https://nextjs.org/blog/next-15-rc#caching-updates).

## Choosing the Right Export

`@storyblok/react` ships two entry points:

| Export                    | Use Case                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@storyblok/react`        | All environments — initialization, rendering, richtext, `storyblokEditable`                                                                 |
| `@storyblok/react/client` | Client-only — live editing components and hooks (`StoryblokPreview`, `StoryblokPreviewRsc`, `useStoryblokState`, `useStoryblokEditorEvent`) |

### When to Use Each Export

**Use `@storyblok/react`** for:

- Setting up `createApiClient` and `defineStoryblokComponents`
- Block components (`storyblokEditable`, `StoryblokRichText`)
- Any code that runs on the server or in shared modules

**Use `@storyblok/react/client`** for:

- Subscribing to Visual Editor events in the browser
- `StoryblokPreview` — client component with a render-prop for SPA and Pages Router live editing
- `StoryblokPreviewRsc` — client component that calls a Server Action to re-render RSC on editor
  events
- `useStoryblokState` / `useStoryblokEditorEvent` — lower-level hooks

> [!NOTE] All `@storyblok/react/client` exports are marked `"use client"` and must not be imported
> from Server Components directly. Pass them as children or use them in dedicated client files.

## Next.js using App Router

App Router pages are React Server Components by default. The SDK supports two live-editing
approaches depending on your needs.

### 1. Initialize

Create `lib/storyblok.ts` once. Both `apiClient` and the returned components are shared across
server and client code.

```ts
// lib/storyblok.ts
import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
});

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
  },
});
```

### 2. Fetch Content

Fetch the story in your Server Component page and pass it down:

```tsx
// app/[[...slug]]/page.tsx
import { apiClient } from "@/lib/storyblok";
import { StoryContent } from "@/components/StoryContent";

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const storySlug = slug ? slug.join("/") : "home";
  const result = await apiClient.stories.get(storySlug, { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <main>Story not found</main>;

  return <StoryContent story={story} />;
}
```

### 3a. Live Editing with `StoryblokPreview` (simpler)

For most apps, wrap the story in a `"use client"` component that uses `StoryblokPreview`:

```tsx
// components/StoryContent.tsx
"use client";

import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return (
    <StoryblokPreview key={story.uuid} story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}
```

### 3b. Live Editing with `StoryblokPreviewRsc` (full RSC streaming)

For apps using Suspense streaming and async Server Components (e.g. slow data fetches inside
blocks), use `StoryblokPreviewRsc` with a Server Action. On every editor event it calls the action
to produce fresh server-rendered output without a full page reload.

```tsx
// lib/actions.tsx
"use server";

import type { Story } from "@storyblok/react";
import type { ReactNode } from "react";
import { StoryContent } from "@/components/StoryContent";

export async function renderContent(story: Story): Promise<ReactNode> {
  return <StoryContent story={story} />;
}
```

```tsx
// app/[[...slug]]/page.tsx
import { apiClient } from "@/lib/storyblok";
import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions";
import { StoryContent } from "@/components/StoryContent";

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const storySlug = slug ? slug.join("/") : "home";
  const result = await apiClient.stories.get(storySlug, { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <main>Story not found</main>;

  return (
    <StoryblokPreviewRsc renderContent={renderContent}>
      <StoryContent story={story} />
    </StoryblokPreviewRsc>
  );
}
```

`StoryContent` here is a plain Server Component (no `"use client"`):

```tsx
// components/StoryContent.tsx
import { StoryblokComponent } from "@/lib/storyblok";
import type { Story } from "@storyblok/react";

export function StoryContent({ story }: { story: Story }) {
  return <StoryblokComponent block={story.content} />;
}
```

> [!NOTE] `StoryblokPreviewRsc` requires Server Actions. If you are using Next.js with
> `output: 'export'` (static export), use `StoryblokPreview` (3a) instead.

**Block components** use `StoryblokComponent` from your `lib/storyblok` for nested blocks:

```tsx
// components/Page.tsx
import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type PageProps = StoryblokComponentProps<{ body: StoryblokBlockData[] }>;

const Page = ({ block }: PageProps) => (
  <main {...storyblokEditable(block)}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
  </main>
);

export default Page;
```

Take a look at the
[Next.js App Router playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground/next-latest)
and the
[Next.js 13 App Router playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground/next-13-app-router)
in this repo.

## Next.js using Pages Router

### 1. Initialize

Set up `lib/storyblok.ts` once and export `apiClient` and `StoryblokComponent`:

```ts
// lib/storyblok.ts
import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
});

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
  },
});
```

No changes are needed in `_app.tsx`.

### 2. Fetching Content

Use `apiClient` in `getStaticProps`, `getServerSideProps`, or `getStaticPaths`:

```tsx
// pages/index.tsx
import type { GetStaticProps } from "next";
import type { Story } from "@storyblok/react";
import { apiClient, StoryblokComponent } from "@/lib/storyblok";

interface Props {
  story: Story;
}

export default function Home({ story }: Props) {
  return <StoryblokComponent block={story.content} />;
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const result = await apiClient.stories.get("home", { query: { version: "draft" } });
  if (!result.data) return { notFound: true };

  return {
    props: { story: result.data.story },
    revalidate: 3600,
  };
};
```

### 3. Listening to Storyblok Visual Editor events

To enable live editing, wrap your content in `StoryblokPreview` from `@storyblok/react/client`. It
holds the latest story in state and re-renders children on every Visual Editor update:

```tsx
// pages/index.tsx
import type { GetStaticProps } from "next";
import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { apiClient, StoryblokComponent } from "@/lib/storyblok";

interface Props {
  story: Story;
}

export default function Home({ story }: Props) {
  return (
    <StoryblokPreview key={story.uuid} story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const result = await apiClient.stories.get("home", { query: { version: "draft" } });
  if (!result.data) return { notFound: true };

  return {
    props: { story: result.data.story },
    revalidate: 3600,
  };
};
```

`StoryblokComponent` renders block components dynamically using the map registered in
`defineStoryblokComponents`.

Take a look at the
[Next.js Pages Router playground](https://github.com/storyblok/monoblok/tree/main/packages/react/playground/next-13-pages-router)
in this repo.

## Features and API

### API Client

`createApiClient` accepts a configuration object that is passed to `@storyblok/api-client`:

```ts
import { createApiClient } from "@storyblok/react";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu", // "eu" | "us" | "ap" | "ca" | "cn"
  cache: { type: "memory" },
  // retry, timeout, rateLimit, …
});
```

If you prefer to use your own data-fetching layer, simply don't call `createApiClient` — the rest of
the SDK (components, richtext, editable) works independently.

### Storyblok Bridge

The bridge is loaded automatically by `StoryblokPreview` and `StoryblokPreviewRsc`. If you need
direct access to the raw bridge, it is available on `window`:

```js
const sbBridge = new window.StoryblokBridge(options);

sbBridge.on(["input", "published", "change"], (event) => {
  // ...
});
```

## Rendering Rich Text

Render rich text fields using the `StoryblokRichText` component, importable directly from
`@storyblok/react` or from the object returned by `defineStoryblokComponents`:

```tsx
import { StoryblokRichText } from "@storyblok/react";

const Page = ({ block }: PageProps) => (
  <div>
    <StoryblokRichText document={block.richtext} />
  </div>
);
```

For more control, use `createRichTextRenderer` to get a plain render function:

```tsx
import { createRichTextRenderer } from "@storyblok/react";

const render = createRichTextRenderer({ optimizeImage: { width: 800 } });

const Page = ({ block }: PageProps) => <div>{render(block.richtext)}</div>;
```

### Overriding default resolvers

Pass a `components` map to override how specific node or mark types are rendered — for example to
use Next.js `Link` or a custom code block component:

```tsx
import {
  StoryblokRichText,
  type StoryblokReactRichTextComponentMap,
  type StoryblokReactRichTextProps,
} from "@storyblok/react";
import Link from "next/link";

function CustomLink({ children, attrs }: StoryblokReactRichTextProps<"link">) {
  return (
    <Link href={attrs?.href ?? ""} target={attrs?.target ?? "_self"}>
      {children}
    </Link>
  );
}

const components: StoryblokReactRichTextComponentMap = {
  link: CustomLink,
  bold: ({ children }) => <b className="font-bold">{children}</b>,
};

const Page = ({ block }: PageProps) => (
  <StoryblokRichText document={block.richtext} components={components} />
);
```

### Static HTML Rich Text Renderer

`renderRichText` returns a plain HTML string. Use it when you need raw HTML output and are
comfortable setting it via `dangerouslySetInnerHTML`:

```tsx
import { renderRichText } from "@storyblok/react";

const Page = ({ block }: PageProps) => (
  <div dangerouslySetInnerHTML={{ __html: renderRichText(block.richtext) }} />
);
```

For React element output (no `dangerouslySetInnerHTML`) use `StoryblokRichText` or
`createRichTextRenderer` as shown above.

### Using fallback components

By default, `StoryblokComponent` logs a warning and returns `null` when a block type has no
registered component. Pass a `fallback` option to `defineStoryblokComponents` to render a custom
fallback instead:

```tsx
import { defineStoryblokComponents } from "@storyblok/react";
import FallbackComponent from "./components/FallbackComponent";

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
  },
  fallback: FallbackComponent,
});
```

The fallback receives the same `block` prop as any other block component.

## Efficiently Loading Storyblok Components in React

`defineStoryblokComponents` registers all block components up front. For large sites this can
increase the initial bundle size. You have two options to reduce it.

### React.lazy

Pass lazy-loaded components directly to `defineStoryblokComponents`. Lazy components are detected
automatically and wrapped in a `Suspense` boundary:

```tsx
import { defineStoryblokComponents } from "@storyblok/react";
import { lazy } from "react";

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: lazy(() => import("./components/Page")),
    teaser: lazy(() => import("./components/Teaser")),
  },
});
```

To show a loading state while the component chunk loads, pass a `suspenseFallback` (global) or
per-component `fallback`:

```tsx
export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: lazy(() => import("./components/Page")),
    weather_widget: {
      component: lazy(() => import("./components/WeatherWidget")),
      fallback: WeatherWidgetSkeleton, // component-level fallback
    },
  },
  suspenseFallback: <GlobalSkeleton />, // global fallback
});
```

### Next.js Dynamic Import

In Next.js use `dynamic` for the same effect with better SSR support:

```tsx
import dynamic from "next/dynamic";
import { defineStoryblokComponents } from "@storyblok/react";

export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: dynamic(() => import("./components/Page")),
    teaser: dynamic(() => import("./components/Teaser")),
  },
});
```

For more options see the
[Next.js Dynamic Import documentation](https://nextjs.org/docs/advanced-features/dynamic-import).

## Troubleshooting

### "Server Actions are not supported with static export"

**Error:** When using Next.js with `output: 'export'`, you might encounter:

```
Error: Server Actions are not supported with static export
```

**Solution:** `StoryblokPreviewRsc` uses Server Actions and is incompatible with static exports. Use
`StoryblokPreview` instead:

```diff
- import { StoryblokPreviewRsc } from "@storyblok/react/client";
+ import { StoryblokPreview } from "@storyblok/react/client";
```

### Live Editing Not Working

**Issue:** Live editing doesn't work in the Visual Editor.

**Possible solutions:**

1. **Not using a preview component**: Wrap your content in `StoryblokPreview` (client component) or
   `StoryblokPreviewRsc` (RSC with Server Actions). Live editing requires one of these.

2. **Development mode**: The Visual Editor bridge only activates when the page is loaded inside the
   Storyblok Visual Editor.

### Component Not Found

**Error:** Seeing `null` output or a fallback instead of your content.

**Solution:** Ensure the component type name in your Storyblok space matches the key in
`defineStoryblokComponents`:

```ts
export const { StoryblokComponent } = defineStoryblokComponents({
  components: {
    page: Page, // matches block with component: "page"
    teaser: Teaser, // matches block with component: "teaser"
  },
});
```

### TypeScript Import Errors

**Issue:** TypeScript can't find exports from `@storyblok/react/client`.

**Solution:** Ensure you're on `@storyblok/react` v7 or later, which includes the `/client` entry
point.

## The Storyblok JavaScript SDK Ecosystem

![A visual representation of the Storyblok JavaScript SDK Ecosystem](https://a.storyblok.com/f/88751/2400x1350/be4a4a4180/sdk-ecosystem.png/m/1200x0)

## Further Resources

- [Quick Start](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)
- [API Documentation](https://www.storyblok.com/docs/api?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)
- [Developer Tutorials](https://www.storyblok.com/tutorials?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)
- [Developer Guides](https://www.storyblok.com/docs/guide/introduction?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)
- [FAQs](https://www.storyblok.com/faqs?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react)

## Support

- Bugs or Feature Requests? [Submit an issue](/../../issues/new).
- Do you have questions about Storyblok or you need help?
  [Join our Discord Community](https://storyblok.com/join-discord).

## Contributing

Please see our
[contributing guidelines](https://github.com/storyblok/.github/blob/master/contributing.md) and our
[code of conduct](https://www.storyblok.com/trust-center?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-react#code-of-conduct).
This project use [semantic-release](https://semantic-release.gitbook.io/semantic-release/) for
generate new versions by using commit messages and we use the Angular Convention to naming the
commits. Check
[this question](https://semantic-release.gitbook.io/semantic-release/support/faq#how-can-i-change-the-type-of-commits-that-trigger-a-release)
about it in semantic-release FAQ.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
