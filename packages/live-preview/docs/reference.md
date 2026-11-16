---
title: "@storyblok/live-preview"
description:
  "@storyblok/live-preview connects a frontend to Storyblok’s Visual Editor, delivering story
  updates as editors type and morphing server-rendered HTML into the page."
---

# @storyblok/live-preview

[@storyblok/live-preview](https://github.com/storyblok/monoblok/tree/main/packages/live-preview)
connects a frontend to the [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor).
It loads the [Preview Bridge](https://www.storyblok.com/docs/libraries/js/preview-bridge), delivers
story updates as editors type, and morphs server-rendered HTML into the page.

## Requirements

The Preview Bridge and the DOM morph run in the browser. `isInEditor()`, `storyblokEditable()`, and
`editableField()` also run on the server.

- **Evergreen web browser** (for example, Chrome, Firefox, Safari, or Edge)

## Installation

Add the package to a project by running this command in the terminal:

```bash
npm install @storyblok/live-preview
```

## Usage

Every app subscribes to Visual Editor updates with `onStoryblokEditorEvent()`. What the callback
does with the updated story depends on who renders the page:

| App type                                                                                               | Callback                                        |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Reactive framework, including server-side rendering with hydration (Next.js, Nuxt, SvelteKit, Angular) | Store the story in component state.             |
| Server-rendered HTML (Astro, server templates)                                                         | Pass the story to `createLivePreviewHandler()`. |

- **Reactive frameworks:** the framework re-renders from state. Morphing the DOM conflicts with the
  framework’s own rendering, so reactive frameworks use neither `createLivePreviewHandler()` nor
  `morphStoryblokDom()`.
- **Server-rendered apps:** the page has no client state to update. The handler asks your server to
  render the updated story and morphs the returned HTML into the page. Learn more in
  [Server-rendered setup](#server-rendered-setup).

Use `morphStoryblokDom()` directly only when you need the morph without the handler’s debouncing and
cancellation. Use `loadStoryblokBridge()` directly only for custom event handling that the shared
bridge doesn’t cover.

`storyblokEditable()`, `editableField()`, and `isInEditor()` work with either approach.

## API

`@storyblok/live-preview` exports the following functions from the package root.

| Export                                                  | Description                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`onStoryblokEditorEvent`](#onstoryblokeditorevent)     | Subscribes to story updates. For reactive frameworks.                     |
| [`createLivePreviewHandler`](#createlivepreviewhandler) | Morphs server-rendered updates into the page. For server-rendered apps.   |
| [`morphStoryblokDom`](#morphstoryblokdom)               | Morphs a new server-rendered DOM tree into the current one.               |
| [`loadStoryblokBridge`](#loadstoryblokbridge)           | Loads the Preview Bridge and constructs a new, unshared instance.         |
| [`storyblokEditable`](#storyblokeditable)               | Returns the attributes that make a block selectable in the Visual Editor. |
| [`editableField`](#editablefield)                       | Returns the attribute that makes a field selectable in the Visual Editor. |
| [`isInEditor`](#isineditor)                             | Checks whether a URL is a Visual Editor request.                          |
| [`isBrowser`](#isbrowser)                               | Checks whether the code runs in a browser.                                |

### `onStoryblokEditorEvent()`

Registers a callback for Visual Editor updates and returns its cleanup function synchronously.

```ts
function onStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  options?: LivePreviewOptions,
): () => void;
```

```ts
import { onStoryblokEditorEvent } from "@storyblok/live-preview";

const stopListening = onStoryblokEditorEvent((story) => {
  // update local state
});

stopListening();
```

The subscription is active as soon as the call returns. The cleanup function works at any time,
including while the Preview Bridge is still loading, so return it directly from a lifecycle API that
expects a synchronous teardown.

Svelte example, returning the cleanup function from `$effect`:

```svelte
<script lang="ts">
  import { onStoryblokEditorEvent } from "@storyblok/live-preview";

  let { data } = $props();
  let story = $derived(data.story);

  $effect(() => onStoryblokEditorEvent((newStory) => (story = newStory)));
</script>
```

React example, returning the cleanup function from `useEffect`:

```tsx
useEffect(() => onStoryblokEditorEvent(setStory, { resolveRelations: ["featured.articles"] }), []);
```

Outside the Visual Editor or on the server, the call does nothing and returns a cleanup function
that does nothing.

#### Events

The Preview Bridge emits three events, each with a fixed behavior:

| Event       | Trigger                        | Behavior                                       |
| ----------- | ------------------------------ | ---------------------------------------------- |
| `input`     | An editor changes a field.     | Calls `callback` with the updated story.       |
| `change`    | An editor saves the story.     | Reloads the page, or calls `options.onChange`. |
| `published` | An editor publishes the story. | Reloads the page, or calls `options.onChange`. |

#### Options

`LivePreviewOptions` extends the Preview Bridge options (`BridgeParams`) with two handlers. The
`options` object accepts the following properties:

| Key                | Description                                                                                                                           | Type                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `resolveRelations` | [Relations](https://www.storyblok.com/docs/concepts/references) to resolve in the story payload, for example `["featured.articles"]`. | `string[]`                                    |
| `resolveLinks`     | Link resolution mode.                                                                                                                 | `"url" \| "story" \| "0" \| "1"`              |
| `customParent`     | Origin of the Visual Editor, for a self-hosted or regional editor.                                                                    | `string`                                      |
| `fallbackLang`     | Fallback language for field-level translations.                                                                                       | `string`                                      |
| `preventClicks`    | Blocks link navigation inside the Visual Editor.                                                                                      | `boolean`                                     |
| `onChange`         | Called on `change` and `published` instead of reloading the page.                                                                     | `(event: StoryblokEditorChangeEvent) => void` |
| `onError`          | Called when the Preview Bridge fails to load. Defaults to `console.error`.                                                            | `(error: unknown) => void`                    |

#### Saved and published changes

By default, saving or publishing reloads the page. To refetch data without a full reload, pass
`onChange`:

```ts
import { invalidateAll } from "$app/navigation";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";

const stopListening = onStoryblokEditorEvent(
  (story) => {
    // update local state
  },
  { onChange: () => invalidateAll() },
);
```

In Next.js, call `router.refresh()` instead. Because every subscription shares one bridge, the page
still reloads unless every active subscription passes `onChange`.

#### Errors

`onStoryblokEditorEvent()` never throws or rejects. A Preview Bridge load failure goes to `onError`,
including a later rebuild of the shared bridge that leaves the subscription without one. The
function removes the subscription before `onError` runs, and skips `onError` for a subscription
cleaned up while the bridge was still loading. Without `onError`, `console.error` logs each failure
once, however many subscriptions it affects.

```ts
const stopListening = onStoryblokEditorEvent(
  (story) => {
    // update local state
  },
  { onError: (error) => reportToMonitoring(error) },
);
```

#### Shared bridge

Every subscription on a page shares one Preview Bridge instance, because the Visual Editor supports
only one bridge configuration per page. The shared bridge merges the options of all active
subscriptions with the following rules:

- **Relations:** `resolveRelations` values are combined.
- **Scalar options:** `customParent`, `resolveLinks`, and `fallbackLang` take the value of the
  earliest active subscription that sets them.
- **`preventClicks`:** `true` wins if any active subscription requests it.
- **`initOnlyOnce`:** always `false`.

A subscribe or cleanup rebuilds the bridge only when it changes the merged options. Subscriptions
made in the same synchronous tick, or while the bridge module is still loading, share one build. A
later change tears down the bridge and builds a new one, which briefly leaves the page without a
bridge. To avoid rebuilds, subscribe with all known options upfront, in the same tick.

A cleanup removes the subscription’s options from the merge right away. A cleanup followed by an
immediate re-subscribe, such as React StrictMode or a Svelte `$effect` re-run, joins the build in
progress instead of starting a second one.

### `createLivePreviewHandler()`

Updates a server-rendered page as editors type. You provide the `update` function that renders the
story. The handler debounces updates, cancels stale ones, and morphs the result into the page.

```ts
function createLivePreviewHandler<TStory extends Story = Story>(
  options: LivePreviewHandlerOptions<TStory>,
): LivePreviewHandler<TStory>;
```

Pass it the `input` stories from `onStoryblokEditorEvent()`:

```ts
import { createLivePreviewHandler, onStoryblokEditorEvent } from "@storyblok/live-preview";

const handler = createLivePreviewHandler({
  currentRoot: () => document.body,
  // renders the story on the server and returns the new <body>, see Server-rendered setup
  update: ({ story, signal }) => renderPreview(story, signal),
});

const stopListening = onStoryblokEditorEvent((story) => {
  void handler.handle({ action: "input", story });
});

// on teardown
stopListening();
handler.dispose();
```

`onStoryblokEditorEvent()` calls back only for `input`. It handles saves and publishes itself, by
reloading the page or calling `onChange`, so the handler’s `onReload` doesn’t run in this setup.

#### Server-rendered setup

A complete setup has a client part and a server part.

**Client:** load the handler only inside the Visual Editor, so visitors never download the morph
code. Keep `createLivePreviewHandler()` in its own module and import it dynamically:

```ts
// preview-handler.ts
import { createLivePreviewHandler } from "@storyblok/live-preview";

export function createPreviewHandler() {
  return createLivePreviewHandler({
    currentRoot: () => document.body,
    update: async ({ story, signal }) => {
      const response = await fetch(location.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to render the preview: ${response.status}`);
      }
      return new DOMParser().parseFromString(await response.text(), "text/html").body;
    },
    // keep attributes changed in the browser, such as an open <details>
    morph: { preserveElementAttributes: true },
  });
}
```

```ts
// preview.ts
import { isInEditor, onStoryblokEditorEvent } from "@storyblok/live-preview";

const handler = isInEditor(new URL(location.href))
  ? import("./preview-handler").then(({ createPreviewHandler }) => createPreviewHandler())
  : undefined;

const stopListening = onStoryblokEditorEvent((story) => {
  void handler?.then((previewHandler) => previewHandler.handle({ action: "input", story }));
});
```

Create one handler per page. A second one doubles every request and morph.

**Server:** the page’s route renders the posted story instead of fetching it. Accept the `POST` only
from the Visual Editor:

```ts
import { isInEditor } from "@storyblok/live-preview";

function isPreviewRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    request.method === "POST" &&
    isInEditor(new URL(request.url)) &&
    contentType === "application/json" &&
    (fetchSite === null || fetchSite === "same-origin")
  );
}
```

The server-side rules for the preview route:

- **Request checks:** the `_storyblok` query parameters are public, so `isInEditor()` alone doesn’t
  prove the request’s origin. Requiring `application/json` forces a CORS preflight for cross-origin
  requests, and `Sec-Fetch-Site` rejects anything that isn’t same-origin.
- **Untrusted body:** anyone can send this request. Use the posted story only to render the preview,
  never for IDs, permissions, or anything else the server relies on.
- **On-demand routes:** the route must render on request. A prerendered or static route can’t answer
  the `POST`, and usually responds with a 404 or 405. Reloading on save and publish still works
  there.
- **Interactive islands:** mark the root of a client-rendered component with `data-preserve-state`,
  so the morph leaves it intact.

#### Options

`createLivePreviewHandler()` accepts the following options:

| Key              | Description                                                                                  | Type                                               |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `currentRoot`    | Returns the element to update. Required.                                                     | `() => Element`                                    |
| `update`         | Renders the story and returns the new root. Abort on `signal`. Required.                     | `(context: { story, signal }) => Promise<Element>` |
| `debounceMs`     | Delay before an `input` event triggers `update`. Defaults to `500`.                          | `number`                                           |
| `morph`          | Options passed to `morphStoryblokDom()`.                                                     | `Omit<DomMorphOptions, "focusedElement">`          |
| `onBeforeUpdate` | Called before an update. Return `false` to skip it.                                          | `(story) => boolean \| void`                       |
| `onUpdated`      | Called after the morph.                                                                      | `(story) => void`                                  |
| `onError`        | Called when `update` or the morph fails. Defaults to `console.error`. Not called for aborts. | `(error: unknown, story) => void`                  |
| `onReload`       | Called on `change` and `published`. Defaults to `window.location.reload()`.                  | `(action: "change" \| "published") => void`        |

On `change` or `published`, the handler cancels a pending `input` update before `onReload` runs, so
stale content can’t overwrite the reload.

#### Return value

`createLivePreviewHandler()` returns an object with the following members:

| Key       | Description                                                                             | Type                       |
| --------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `handle`  | Processes an event. Resolves once the update is scheduled, not once the DOM is updated. | `(event) => Promise<void>` |
| `dispose` | Cancels any pending update. Call it on teardown.                                        | `() => void`               |

### `morphStoryblokDom()`

Morphs a new DOM tree into the current one. It doesn’t fetch content or listen to Preview Bridge
events.

```ts
function morphStoryblokDom(
  currentRoot: Element,
  nextRoot: Element,
  options?: DomMorphOptions,
): DomMorphResult;
```

```ts
import { morphStoryblokDom } from "@storyblok/live-preview";

morphStoryblokDom(document.body, nextBody, {
  focusedElement: document.querySelector('[data-blok-focused="true"]'),
});
```

When the Visual Editor has a block focused, the function morphs only that block. The rest of
`currentRoot` stays as is until an update finds no focused block. The function preserves interactive
form state (`value`, `checked`, `selected`) that the user changed.

`morphStoryblokDom()` mutates `nextRoot`, so discard `nextRoot` after the call instead of reusing or
caching it.

#### Options

`morphStoryblokDom()` accepts the following options:

| Key                         | Description                                                                                                          | Type                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `focusedElement`            | The focused block. Pass `null` to morph the full root. Detected automatically when omitted.                          | `Element \| null`                                     |
| `keyAttribute`              | Attribute that matches the same block across both trees. Defaults to `"data-blok-uid"`.                              | `string`                                              |
| `focusedAttribute`          | Attribute that marks the focused block. Defaults to `"data-blok-focused"`.                                           | `string`                                              |
| `preserveStateAttribute`    | Attribute that marks a subtree to skip entirely, for example a hydrated island. Defaults to `"data-preserve-state"`. | `string`                                              |
| `preserveElementAttributes` | Keeps the current attributes of every matched element instead of applying new ones. Defaults to `false`.             | `boolean`                                             |
| `onBeforeElUpdated`         | Extra update policy, applied after the default one. Return `false` to skip an element.                               | `(fromEl: Element, toEl: Element) => boolean \| void` |

#### Return value

`morphStoryblokDom()` returns a `DomMorphResult` with one field, `scope`: `"focused"` when the
function morphed only the focused block, or `"root"` when it morphed the full root.

### `loadStoryblokBridge()`

Loads the Preview Bridge and returns a new instance. Each call returns a new, unshared instance. To
share one bridge across components, use `onStoryblokEditorEvent()` instead.

```ts
function loadStoryblokBridge(config?: BridgeParams): Promise<StoryblokBridge>;
```

```ts
import { loadStoryblokBridge } from "@storyblok/live-preview";

const bridge = await loadStoryblokBridge({ resolveRelations: ["featured.articles"] });

bridge.on(["input", "change", "published"], (event) => {
  // custom preview handling
});
```

### `storyblokEditable()`

Returns the attributes that make a block selectable in the Visual Editor. Spread them onto the
block’s root element.

```ts
function storyblokEditable(block?: { _editable?: string }): Record<string, string>;
```

```tsx
import { storyblokEditable } from "@storyblok/live-preview";

<section {...storyblokEditable(blok)}>{/* ... */}</section>;
```

`storyblokEditable()` returns `{}` when the block has no valid `_editable` value, for example
outside the Visual Editor.

### `editableField()`

Returns the attribute that makes a single field selectable in the Visual Editor.

```ts
function editableField(field: string): EditableFieldAttributes | Record<string, never>;
```

```tsx
import { editableField } from "@storyblok/live-preview";

<h1 {...editableField("headline")}>{blok.headline}</h1>;
```

`editableField()` returns `{}` for an empty field name.

### `isInEditor()`

Checks whether a URL is a Visual Editor request. The URL must include the `_storyblok`,
`_storyblok_c`, and `_storyblok_tk[space_id]` query parameters.

```ts
function isInEditor(url: URL, options?: { spaceId?: string }): boolean;
```

```ts
import { isInEditor } from "@storyblok/live-preview";

if (isInEditor(new URL(request.url), { spaceId: "123456" })) {
  // serve draft content
}
```

Pass `spaceId` to also require the request to come from that space.

### `isBrowser()`

Returns `true` when the code runs in a browser.

```ts
function isBrowser(): boolean;
```

## Types

`@storyblok/live-preview` exports the following types.

| Type                             | Description                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `LivePreviewOptions`             | Options for `onStoryblokEditorEvent()`.                                                        |
| `LivePreviewStory<TStory>`       | Story payload from the Visual Editor. `id` is required, and `uuid` and `content` are optional. |
| `StoryblokEditorChangeEvent`     | The `change` or `published` event passed to `onChange`.                                        |
| `LivePreviewHandler`             | Return value of `createLivePreviewHandler()`.                                                  |
| `LivePreviewHandlerOptions`      | Options for `createLivePreviewHandler()`.                                                      |
| `LivePreviewEvent`               | Preview Bridge event accepted by `handler.handle()`.                                           |
| `LivePreviewUpdateContext`       | Argument of the `update` option: `{ story, signal }`.                                          |
| `DomMorphOptions`                | Options for `morphStoryblokDom()`.                                                             |
| `DomMorphResult`                 | Return value of `morphStoryblokDom()`.                                                         |
| `BridgeParams`                   | Preview Bridge options, re-exported from `@storyblok/preview-bridge`.                          |
| `Story`, `Block`, `BlockContent` | Content Delivery API story and block types.                                                    |

## Further resources

- [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor)—Learn how live editing
  works in the Visual Editor concept.
- [@storyblok/preview-bridge Package Reference](https://www.storyblok.com/docs/libraries/js/preview-bridge)—Find
  the Preview Bridge options and events in the @storyblok/preview-bridge reference.
- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn
  how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
