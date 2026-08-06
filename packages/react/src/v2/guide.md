# Using `@storyblok/react/next` with Next.js App Router

This guide explains how `@storyblok/react/next` works, how it is wired up in this project, and how to handle real-world patterns: async components with slow fetches, live preview, and mixing client interactivity with server-rendered content.

> **Playground:** A fully working Next.js App Router example using this SDK is available at
> [github.com/dipankarmaikap/nextjs-storyblok-react-sdk-v2](https://github.com/dipankarmaikap/nextjs-storyblok-react-sdk-v2).
> All code snippets in this guide are taken from that repository.

---

## Table of Contents

- [Using `@storyblok/react/next` with Next.js App Router](#using-storyblokreactnext-with-nextjs-app-router)
  - [Table of Contents](#table-of-contents)
  - [0. Installation](#0-installation)
  - [1. Setup: client and registry](#1-setup-client-and-registry)
  - [2. Rendering a page](#2-rendering-a-page)
  - [3. Production vs. preview: the two-deployment strategy](#3-production-vs-preview-the-two-deployment-strategy)
    - [How it works](#how-it-works)
    - [How the page reacts to `isPreview`](#how-the-page-reacts-to-ispreview)
  - [4. Live preview with `StoryblokPreview`](#4-live-preview-with-storyblokpreview)
  - [5. Async components with slow fetches — WeatherWidget](#5-async-components-with-slow-fetches--weatherwidget)
    - [The problem](#the-problem)
    - [The solution: `suspense: true` in the registry](#the-solution-suspense-true-in-the-registry)
    - [The component](#the-component)
    - [Caching strategy](#caching-strategy)
    - [The skeleton](#the-skeleton)
  - [6. Client interactivity — Accordion (the right pattern)](#6-client-interactivity--accordion-the-right-pattern)
    - [The challenge](#the-challenge)
    - [The pattern: Server Component wrapper + Client Component shell](#the-pattern-server-component-wrapper--client-component-shell)
    - [Why this works](#why-this-works)
  - [7. The broken pattern — why you cannot import server code inside a Client Component](#7-the-broken-pattern--why-you-cannot-import-server-code-inside-a-client-component)
    - [Why this fails at build time](#why-this-fails-at-build-time)
    - [The rule](#the-rule)

---

## 0. Installation

This guide uses a prerelease build published via [pkg.pr.new](https://pkg.pr.new). Install it directly by URL — no registry publish required:

```bash
npm i https://pkg.pr.new/@storyblok/react@a76b1c7
```

This installs the exact commit that the guide is written against.

---

## 1. Setup: client and registry

Everything starts in `app/lib/storyblok.tsx`. Three things are created here:

**`isPreview`** — a module-level boolean that is `true` on the preview deployment and `false` on production. It is evaluated once per cold start and stays fixed for the lifetime of the process.

**`createApiClient`** — a typed wrapper around the Storyblok Delivery API. On the preview deployment, `cache: { strategy: "network-first" }` is set so every request goes to Storyblok directly, bypassing the in-memory cache. On production, the default cache-first strategy (60 s TTL) applies.

**`createRegistry`** — maps Storyblok component names (as defined in your space) to React components. It also accepts per-component Suspense configuration.

```tsx
// app/lib/storyblok.tsx
import { createApiClient, createRegistry } from '@storyblok/react/next';

/**
 * True on the preview deployment (STORYBLOK_ENV=preview).
 * False on production (env var absent or set to any other value).
 *
 * This is a module-level constant: it is evaluated once per cold start and
 * stays fixed for the lifetime of the process. Use it everywhere you need
 * to branch between "show draft content + live editing" and "show published
 * content + full caching".
 */
export const isPreview = process.env.STORYBLOK_ENV === 'preview';

export const client = createApiClient({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_DELIVERY_API_TOKEN!,
  region: process.env.NEXT_PUBLIC_STORYBLOK_REGION as 'us' | 'eu',
  // On the preview deployment, bypass the in-memory cache so every request
  // fetches the latest draft content from Storyblok directly.
  // On production, the default cache-first strategy (60 s TTL) applies.
  ...(isPreview && { cache: { strategy: 'network-first' } }),
});

export const { StoryblokComponent, StoryblokBlocks } = createRegistry({
  components: {
    page: Page,
    grid: Grid,
    teaser: Teaser,
    feature: Feature,
    product_list: ProductList,
    accordion: Accordion,

    // Components that are async and slow get a suspense boundary + skeleton:
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true,
    },
  },
  fallback: FallbackBlock, // rendered when no match is found
});
```

- **`StoryblokComponent`** renders a single blok by looking up its `component` field in the registry.
- **`StoryblokBlocks`** iterates an array of bloks and renders each one via `StoryblokComponent`.
- When `suspense: true` is set, the registry automatically wraps the component in a `<Suspense>` boundary using the provided `fallback`. This means a slow component will stream in after the skeleton, without blocking the rest of the page.

---

## 2. Rendering a page

The recommended pattern uses a catch-all route `app/[[...slug]]/page.tsx` to handle every URL in the app.

Because Next.js 16 makes `params` a `Promise`, slug access is deferred inside a `<Suspense>` boundary to keep the outer component synchronous (static shell). `PageContent` then suspends on the Storyblok fetch.

**`StoryContent`** is a small Server Component that acts as a single source of truth for how a story is rendered. It is used in two places: the initial server render in `page.tsx`, and inside the `renderContent` Server Action called by `StoryblokPreview` on live editor updates. Keeping the layout markup in one place means you never have to keep two callsites in sync.

```tsx
// app/components/StoryContent.tsx
import type { Story } from '@storyblok/react/next';
import { StoryblokComponent } from '../lib/storyblok';

export function StoryContent({ story }: { story: Story }) {
  return (
    <main>
      <StoryblokComponent blok={story.content} />
    </main>
  );
}
```

```tsx
// app/[[...slug]]/page.tsx
import { Suspense } from 'react';
import { StoryblokPreview } from '@storyblok/react/next/rsc';
import { renderContent } from '../lib/actions';
import { client, isPreview } from '../lib/storyblok';
import { StoryContent } from '../components/StoryContent';

type Params = Promise<{ slug?: string[] }>;

/**
 * Optional catch-all route — handles every URL in the app.
 *
 * slug segments   → Storyblok story slug
 * /               → undefined          → "home"
 * /about          → ["about"]          → "about"
 * /blog/my-post   → ["blog","my-post"] → "blog/my-post"
 *
 * In Next.js 16 `params` is a Promise, so slug access is pushed inside
 * a <Suspense> boundary to keep the outer component sync (static shell).
 * PageContent then suspends for the Storyblok fetch.
 */
export default function CatchAllPage({ params }: { params: Params }) {
  return (
    <Suspense>
      {params.then(({ slug }) => {
        const storySlug = slug?.join('/') ?? 'home';
        const storyPromise = client.stories.get(storySlug, {
          query: { version: isPreview ? 'draft' : 'published' },
        });
        return <PageContent storyPromise={storyPromise} />;
      })}
    </Suspense>
  );
}

async function PageContent({
  storyPromise,
}: {
  storyPromise: ReturnType<typeof client.stories.get>;
}) {
  const { data } = await storyPromise;
  const story = data?.story;

  if (!story) {
    return <main>Story not found</main>;
  }

  const content = <StoryContent story={story} />;

  // In production: return pre-rendered content directly
  if (!isPreview) {
    return content;
  }

  // On the preview deployment: wrap in StoryblokPreview for live updates
  return (
    <>
      <div style={{ background: 'yellow', padding: '10px' }}>
        PREVIEW MODE IS ON
      </div>
      <StoryblokPreview renderContent={renderContent}>
        {content}
      </StoryblokPreview>
    </>
  );
}
```

The `renderContent` Server Action is kept in a separate file so it can be passed as a serialisable reference to `StoryblokPreview`:

```tsx
// app/lib/actions.tsx
'use server';

import type { ReactNode } from 'react';
import type { Story } from '@storyblok/react/next';
import { StoryContent } from '../components/StoryContent';

export async function renderContent(story: Story): Promise<ReactNode> {
  return <StoryContent story={story} />;
}
```

> `renderContent` must be a **Server Action** (`"use server"`) because `StoryblokPreview` is a Client Component that needs to call it over the network when the editor sends a content update.

---

## 3. Production vs. preview: the two-deployment strategy

Rather than using Next.js Draft Mode cookies to toggle preview on a single deployment, the recommended approach is **two separate deployments of the same codebase** driven by a single environment variable.

### How it works

| Deployment | `STORYBLOK_ENV`            | `isPreview` | Story version | API cache                      | Live editing            |
| ---------- | -------------------------- | ----------- | ------------- | ------------------------------ | ----------------------- |
| Production | unset (or any other value) | `false`     | `published`   | cache-first (60 s TTL)         | off                     |
| Preview    | `"preview"`                | `true`      | `draft`       | `network-first` (always fresh) | on (`StoryblokPreview`) |

Set `STORYBLOK_ENV=preview` only in the environment variables of your preview deployment (e.g. a Vercel preview environment or a separate Vercel project). The production deployment does not set this variable.

**Why two deployments instead of a cookie?**

- **No per-request branching.** `isPreview` is a module-level constant evaluated at cold start. The production render path is entirely free of preview-related code — no cookie reads, no `draftMode()` calls, no conditional fetches.
- **Predictable caching.** The production deployment can rely on stable Next.js Data Cache behaviour. The preview deployment opts fully out of caching (`network-first`) so editors always see their latest save.
- **Simpler ops.** Each deployment has a clear, single purpose. There is no risk of a user accidentally accessing draft content on the production URL because the token that enables preview is never set there.

**Configure the Visual Editor preview URL** in your Storyblok space settings to point at the preview deployment URL. The production URL stays clean.

### How the page reacts to `isPreview`

```
isPreview === false  →  fetch published  →  return static content
isPreview === true   →  fetch draft      →  return StoryblokPreview (listens for editor messages)
```

---

## 4. Live preview with `StoryblokPreview`

`StoryblokPreview` is a Client Component exported from `@storyblok/react/next/rsc`. It:

- Receives the initially server-rendered content as **`children`** so the page is not blank on first load.
- Listens for `postMessage` events from the Storyblok Visual Editor iframe.
- When the editor sends an updated story, calls your `renderContent` Server Action, re-renders the content on the server, and swaps in the new React tree.
- **Debounces** editor events (default 300 ms) so rapid keystrokes do not each fire a separate Server Action call.

```tsx
<StoryblokPreview renderContent={renderContent}>{content}</StoryblokPreview>;
```

**Props**

| Prop            | Type                                   | Required | Default | Description                                                                    |
| --------------- | -------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `renderContent` | `(story: Story) => Promise<ReactNode>` | ✓        | —       | Server Action called on each editor update                                     |
| `children`      | `ReactNode`                            | ✓        | —       | Initial server-rendered content                                                |
| `debounceMs`    | `number`                               | —        | `300`   | Milliseconds to wait after the last editor event before triggering a re-render |

## 5. Async components with slow fetches — WeatherWidget

### The problem

Some Storyblok bloks need data from external APIs or databases. If a weather API takes 10 seconds to respond, you do not want the entire page to block.

### The solution: `suspense: true` in the registry

When you register a component with `suspense: true` and a `fallback`, the registry wraps it in a `<Suspense>` boundary. The page streams HTML to the browser immediately with the skeleton visible. Once the async component finishes, React flushes the real content.

```tsx
// app/lib/storyblok.tsx
export const { StoryblokComponent, StoryblokBlocks } = createRegistry({
  components: {
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true,
    },
  },
});
```

### The component

`WeatherWidget` is a plain `async` Server Component. It calls `getWeather`, which routes through the cache layers below.

```tsx
// app/components/WeatherWidget.tsx
export async function WeatherWidget({ blok }: WeatherWidgetProps) {
  const weatherData = await getWeather(blok.location ?? '');

  return (
    <div {...storyblokEditable(blok)}>
      <h3>{blok.title}</h3>
      <p>
        {weatherData.temperature}
        °C —
        {weatherData.windSpeed}
        {' '}
        km/h
      </p>
    </div>
  );
}
```

### Caching strategy

Weather data is fetched from an external API that is completely independent of Storyblok story content. Because of this, the same cache is used on both the production and preview deployments. There is no reason to bypass it in preview — doing so would cause a slow skeleton flash on every editor change even though the weather data has not changed.

Three layers work together:

| Layer              | API     | Scope                      | Purpose                                                                      |
| ------------------ | ------- | -------------------------- | ---------------------------------------------------------------------------- |
| `react.cache()`    | React   | Single request             | Deduplicates calls within one render (e.g. two bloks with the same location) |
| `unstable_cache()` | Next.js | Cross-request (Data Cache) | Persists results across requests, 60 s TTL                                   |
| Raw fetch          | —       | —                          | The slow external API call (simulated at 10 s)                               |

```tsx
// Layer 1 — raw fetch (slow, no caching)
async function fetchWeatherData(location: string): Promise<WeatherData> {
  // calls external weather API …
}

// Layer 2 — cross-request cache (Next.js Data Cache, 60-second TTL)
//
// unstable_cache persists results to the Next.js Data Cache (disk-backed)
// so entries survive across requests and serverless instances.
// Used on both production and preview — weather data is external and
// independent of Storyblok story content, so bypassing it in preview
// would cause a needless skeleton flash on every editor change.
const getCachedWeather = unstable_cache(fetchWeatherData, ['weather'], {
  revalidate: 60,
});

// Layer 3 — request deduplication (React cache)
//
// react.cache() deduplicates calls within a single render pass.
// If two WeatherWidget bloks on the same page share the same location,
// only one cache lookup is made for the entire request.
const getWeather = cache(getCachedWeather);
```

The `network-first` strategy set on `createApiClient` for the preview deployment only bypasses the **Storyblok API client's** internal cache (story JSON). It does not affect `unstable_cache` or `react.cache()` used by `WeatherWidget` — those remain intact on both deployments.

### The skeleton

`WeatherWidgetSkeleton` renders a pulse animation with the same layout as the real widget, so there is no layout shift when the data arrives.

```tsx
// app/components/WeatherWidgetSkeleton.tsx
export function WeatherWidgetSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-6">
      <div className="animate-pulse">
        <div className="h-6 w-40 rounded bg-zinc-800" />
        {/* ... matching layout placeholders ... */}
      </div>
    </div>
  );
}
```

---

## 6. Client interactivity — Accordion (the right pattern)

### The challenge

The Accordion needs `useState` for open/close behaviour — that means it must be a Client Component. But its body is a Storyblok `body` field containing nested bloks, which may include Server Components that fetch from a database.

You cannot render Server Components inside a Client Component. But you _can_ pass pre-rendered Server Component output as `children`.

### The pattern: Server Component wrapper + Client Component shell

The solution splits the work into two files:

**`AccordionShell.tsx` — Client Component**

Handles only UI state. It knows nothing about Storyblok bloks or server-only code. It receives its content as `children` and shows or hides it.

```tsx
// app/components/patterns/AccordionShell.tsx
'use client';

import { type ReactNode, useState } from 'react';
import { type SbBlokData, storyblokEditable } from '@storyblok/react/next';

export function AccordionShell({ title, children, blok, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section {...storyblokEditable(blok)}>
      <button onClick={() => setOpen(!open)}>{title}</button>
      {open && <div>{children}</div>}
    </section>
  );
}
```

**`Accordion.tsx` — Server Component wrapper**

Registered in the component registry. It runs on the server, renders the `body` bloks via `StoryblokBlocks`, and passes the result as `children` to `AccordionShell`.

```tsx
// app/components/Accordion.tsx
import { AccordionShell } from './patterns/AccordionShell';
import { StoryblokBlocks } from '../lib/storyblok';

export function Accordion({ blok }) {
  return (
    <AccordionShell
      title={blok.title || 'Accordion'}
      defaultOpen={blok.default_open}
      blok={blok}
    >
      {/* StoryblokBlocks executes on the server.
          The rendered output is passed as children — not the component reference. */}
      {blok.body?.length ? <StoryblokBlocks blocks={blok.body} /> : null}
    </AccordionShell>
  );
}
```

### Why this works

When React processes `Accordion` (a Server Component), it renders `StoryblokBlocks` and resolves all nested components — including any that query a database — entirely on the server. The result is serialised HTML (React's server payload). That payload is what gets passed as `children` to `AccordionShell`.

By the time `AccordionShell` runs on the client, `children` is already a chunk of inert HTML. The client component is just toggling visibility — it never touches server-only code.

```
Server                           Client
------                           ------
Accordion
  └─ StoryblokBlocks            (resolves here)
       └─ ProductList
            └─ ProductRows
                 └─ db.ts       (server-only, fine)
  └─ AccordionShell ──────────> AccordionShell
       children = <html.../>         useState(open)
                                     {open && children}
```

---

## 7. The broken pattern — why you cannot import server code inside a Client Component

`app/components/_BrokenAccordion.example.tsx` demonstrates what goes wrong when you skip the wrapper pattern.

```tsx
// _BrokenAccordion.example.tsx (commented out — DO NOT USE)
'use client';

import { StoryblokBlocks } from '../lib/storyblok'; // <-- THIS BREAKS THE BUILD

export function BrokenAccordion({ blok }) {
  const [open, setOpen] = useState(blok.default_open || false);

  return (
    <div>
      <button onClick={() => setOpen(!open)}>{blok.title}</button>
      {open && <StoryblokBlocks blocks={blok.body} />}
    </div>
  );
}
```

### Why this fails at build time

Next.js performs static analysis of the import graph. When it encounters `"use client"`, it marks that file as a client module. Every `import` inside it is then also pulled into the client bundle.

The import chain looks like this:

```
BrokenAccordion  ('use client')
  └─ imports StoryblokBlocks  (from registry)
       └─ registry imports ProductList
            └─ ProductList imports ProductRows
                 └─ ProductRows imports db.ts
                      └─ db.ts has  import "server-only"
```

The `server-only` package throws a hard build error the moment it is included in a client bundle:

```
Error: You're importing a component that needs 'server-only'. That only works
in a Server Component but one of its parents is marked with 'use client'.
```

This is not specific to Storyblok. Any time an editor adds a new blok type whose component transitively imports server-only code, a `BrokenAccordion`-style Client Component would break the build. The wrapper pattern insulates the client module from the entire server import tree.

### The rule

> A Client Component can **use** the output of Server Components via `children` or props, but it can **never import** a module that transitively imports server-only code.

The `children` prop is the escape hatch. It carries already-resolved React elements — plain data — not the server module itself. The module boundary is never crossed.

| Approach                                                         | Import graph                         | Result          |
| ---------------------------------------------------------------- | ------------------------------------ | --------------- |
| `BrokenAccordion` imports `StoryblokBlocks`                      | Client → server-only                 | Build error     |
| `Accordion` (wrapper) passes `<StoryblokBlocks />` as `children` | Server renders, client receives HTML | Works correctly |
