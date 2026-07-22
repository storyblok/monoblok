# Using `@storyblok/react/next` with Next.js App Router

This guide explains how `@storyblok/react/next` works, how it is wired up in this project, and how to handle real-world patterns: async components with slow fetches, draft mode, and mixing client interactivity with server-rendered content.

---

## Table of Contents

- [Using `@storyblok/react/next` with Next.js App Router](#using-storyblokreactnext-with-nextjs-app-router)
  - [Table of Contents](#table-of-contents)
  - [0. Installation](#0-installation)
  - [1. Setup: client and registry](#1-setup-client-and-registry)
  - [2. Rendering a page](#2-rendering-a-page)
  - [3. Draft mode: enable and disable](#3-draft-mode-enable-and-disable)
    - [Enable — `app/api/draft/route.ts`](#enable--appapidraftroutets)
    - [Disable — `app/api/disable-draft/route.ts`](#disable--appapidisable-draftroutets)
    - [How the page reacts to draft mode](#how-the-page-reacts-to-draft-mode)
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
npm i https://pkg.pr.new/@storyblok/react@fc8fac6
```

This installs the exact commit that the guide is written against.

---

## 1. Setup: client and registry

Everything starts in `app/lib/storyblok.tsx`. Two things are created here:

**`createApiClient`** — a typed wrapper around the Storyblok Delivery API.

**`createRegistry`** — maps Storyblok component names (as defined in your space) to React components. It also accepts per-component Suspense configuration.

```tsx
// app/lib/storyblok.tsx
import { createApiClient, createRegistry } from '@storyblok/react/next';

export const client = createApiClient({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_DELIVERY_API_TOKEN!,
  region: process.env.NEXT_PUBLIC_STORYBLOK_REGION,
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

`app/page.tsx` is a **Server Component**. It:

1. Fetches the story from Storyblok using `client.stories.get`.
2. Calls the `renderContent` Server Action to turn the story content into React elements.
3. Either returns the static content directly (production) or wraps it in `StoryblokPreview` (draft mode).

```tsx
// app/page.tsx
import { StoryblokPreview } from '@storyblok/react/next/rsc';
import { draftMode } from 'next/headers';
import { renderContent } from './lib/actions';
import { client } from './lib/storyblok';

export default async function Home() {
  const { isEnabled: isDraftMode } = await draftMode();

  const { data } = await client.stories.get('home', {
    query: { version: 'draft' },
  });

  const story = data?.story;
  if (!story) {
    return <main>Story not found</main>;
  }

  const content = await renderContent(story);

  // In production: return pre-rendered content directly
  if (!isDraftMode) {
    return content;
  }

  // In draft mode: wrap in StoryblokPreview for live updates
  return (
    <>
      <div style={{ background: 'yellow', padding: '10px' }}>
        DRAFT MODE IS ON
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
import { StoryblokComponent } from './storyblok';

export async function renderContent(story: Story): Promise<ReactNode> {
  return (
    <main>
      <StoryblokComponent blok={story.content} />
    </main>
  );
}
```

> `renderContent` must be a **Server Action** (`"use server"`) because `StoryblokPreview` is a Client Component that needs to call it over the network when the editor sends a content update.

---

## 3. Draft mode: enable and disable

Next.js Draft Mode sets a secure cookie that instructs the app to skip caches and serve unpublished content.

### Enable — `app/api/draft/route.ts`

Storyblok calls this URL (configured in your space's Visual Editor settings) when a user opens the editor preview. A secret token is validated before enabling draft mode.

```ts
// app/api/draft/route.ts
import { draftMode } from 'next/headers';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  // Reject requests without the correct token
  if (secret !== process.env.NEXT_PUBLIC_STORYBLOK_DELIVERY_API_TOKEN) {
    return new Response('Invalid token', { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  return new Response('Draft mode enabled', { status: 200 });
}
```

### Disable — `app/api/disable-draft/route.ts`

Visiting this route clears the draft cookie and returns the app to production mode.

```ts
// app/api/disable-draft/route.ts
import { draftMode } from 'next/headers';
import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  const draft = await draftMode();
  draft.disable();

  return new Response('Draft mode disabled', { status: 200 });
}
```

### How the page reacts to draft mode

Back in `app/page.tsx`, the `draftMode()` check decides which rendering path to take:

```
isDraftMode === false  →  return static content (no live preview overhead)
isDraftMode === true   →  return StoryblokPreview (listens for editor messages)
```

This keeps the production render path completely free of any preview-specific code.

---

## 4. Live preview with `StoryblokPreview`

`StoryblokPreview` is a Client Component exported from `@storyblok/react/next/rsc`. It:

- Receives the initially server-rendered content as **`children`** so the page is not blank on first load.
- Listens for `postMessage` events from the Storyblok Visual Editor iframe.
- When the editor sends an updated story, calls your `renderContent` Server Action, re-renders the content on the server, and swaps in the new React tree.
- **Debounces** editor events (default 300 ms) so rapid keystrokes do not each fire a separate Server Action call.

```tsx
<StoryblokPreview renderContent={renderContent}>
  {content}
</StoryblokPreview>;
```

**Props**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `renderContent` | `(story: Story) => Promise<ReactNode>` | ✓ | — | Server Action called on each editor update |
| `children` | `ReactNode` | ✓ | — | Initial server-rendered content |
| `debounceMs` | `number` | — | `300` | Milliseconds to wait after the last editor event before triggering a re-render |

**Why `children` and not a named prop?**

Passing the initial RSC tree as `children` (directly from the Server Component) keeps it inside React's RSC streaming channel. Suspense boundaries in that tree work correctly — the page streams the skeleton immediately and flushes the slow component once it resolves.

If the same tree were passed as a named prop (e.g. `initialContent={content}`) and stored in `useState`, the RSC serialiser would need to fully await every async component in the subtree before it could send the prop value to the Client Component. That bypasses Suspense and blocks the entire response for the full duration of the slowest component — exactly the 10-second block you would otherwise see with `WeatherWidget`.

**Why debounce?**

Without debouncing, every keystroke in the Visual Editor fires an `onStoryblokEditorEvent`. Each event triggers a `renderContent` Server Action call. If the component tree contains a slow async component (e.g. an external API fetch), and the editor is editing the field that forms part of the cache key (e.g. the `location` field on `WeatherWidget`), each intermediate value — `"L"`, `"Lo"`, `"Lon"` — would kick off its own slow fetch. With a 300 ms debounce the Server Action only fires after the user pauses, eliminating wasted in-flight requests.

Because `renderContent` is a Server Action, all re-renders run entirely on the server — the client never receives raw Storyblok JSON or executes component logic in the browser.

---

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

`WeatherWidget` is a plain `async` Server Component. It reads the current draft mode state and calls `getWeather`, which routes to the correct cache layer. No special hooks or wrappers are required.

```tsx
// app/components/WeatherWidget.tsx
export async function WeatherWidget({ blok }: WeatherWidgetProps) {
  // draftMode() is request-scoped — must be called inside the component,
  // never at module level where it would only run once at startup.
  const { isEnabled: isDraftMode } = await draftMode();

  const weatherData = await getWeather(blok.location, isDraftMode);

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
      <p>
        Mode:
        {isDraftMode ? 'draft' : 'production'}
      </p>
    </div>
  );
}
```

### Caching strategy

Four layers work together to avoid re-running a slow 10-second fetch unnecessarily:

| Layer | API | Scope | Used when |
| ----------------------- | ----------- | -------------------------- | ----------------------------------------------------------------------------- |
| `react.cache()` | React | Single request | Deduplicates calls within one render (e.g. two bloks with the same location) |
| `unstable_cache()` | Next.js | Cross-request (Data Cache) | Production — persists results across requests, 60 s TTL |
| `LRUCache` | `lru-cache` | Server process | Draft mode — TTL (5 min) keeps data fresh; `max: 500` bounds memory |
| `inFlightDraftFetches` | `Map` | In-flight only | Deduplicates concurrent fetches for the same key before the cache is warm |

```tsx
// Layer 1 — raw fetch (slow, no caching)
async function fetchWeatherData(location: string): Promise<WeatherData> {
  // ...
}

// Layer 2a — production: cross-request cache, revalidates every 60 seconds
const getWeatherProduction = unstable_cache(fetchWeatherData, ['weather'], {
  revalidate: 60,
});

// Layer 2b — draft mode: LRUCache with TTL + max-size cap
//
// TTL (5 min): entries expire so editors always see reasonably fresh data,
// and keys never accessed again eventually fall out of the cache.
//
// max (500): hard cap — the least-recently-used key is evicted first when
// the limit is reached, preventing unbounded memory growth.
//
// inFlightDraftFetches: if multiple editor events arrive before the first
// fetch for a given location completes, they all share the same Promise
// instead of each starting an independent 10-second request.
const draftModeCache = new LRUCache<string, WeatherData>({
  max: 500,
  ttl: 5 * 60 * 1000,
});
const inFlightDraftFetches = new Map<string, Promise<WeatherData>>();

async function getWeatherDraft(location: string): Promise<WeatherData> {
  const cached = draftModeCache.get(location);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightDraftFetches.get(location);
  if (inFlight) {
    return inFlight;
  }

  const promise = fetchWeatherData(location).then((data) => {
    draftModeCache.set(location, data);
    inFlightDraftFetches.delete(location);
    return data;
  });
  inFlightDraftFetches.set(location, promise);
  return promise;
}

// Layer 3 — request deduplication: routes to the correct layer
//           react.cache() ensures only one lookup per location per request
const getWeather = cache(async (location: string, isDraftMode: boolean) => {
  if (isDraftMode) {
    return getWeatherDraft(location); // → LRUCache (TTL + max size)
  }
  return getWeatherProduction(location); // → Next.js Data Cache
});
```

The routing decision (`isDraftMode ? LRUCache : unstable_cache`) is made in `getWeather`, not inside `fetchWeatherData`. This keeps each layer's responsibility clear and means `unstable_cache` is never involved in draft-mode requests.

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
