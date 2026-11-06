# @storyblok/live-preview API Reference

`@storyblok/live-preview` connects a frontend to the Storyblok Visual Editor. It loads the Preview
Bridge, delivers story updates as editors type, and morphs server-rendered HTML into the page.

```bash
npm install @storyblok/live-preview
```

All exports are named exports from the package root:

```ts
import {
  createLivePreviewHandler,
  editableField,
  isBrowser,
  isInEditor,
  loadStoryblokBridge,
  morphStoryblokDom,
  onStoryblokEditorEvent,
  storyblokEditable,
} from "@storyblok/live-preview";
```

| Export                     | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `onStoryblokEditorEvent`   | Subscribe to story updates. For reactive frameworks.                    |
| `createLivePreviewHandler` | Morph server-rendered updates into the page. For server-rendered apps.  |
| `morphStoryblokDom`        | Morph a new server-rendered DOM tree into the current one.              |
| `loadStoryblokBridge`      | Load the Preview Bridge and construct a new, unshared instance.         |
| `storyblokEditable`        | Build the attributes that make a block selectable in the Visual Editor. |
| `editableField`            | Build the attribute that makes a field selectable in the Visual Editor. |
| `isInEditor`               | Check whether a URL is a Visual Editor request.                         |
| `isBrowser`                | Check whether the code runs in a browser.                               |

## Choose an approach

Every app subscribes with `onStoryblokEditorEvent()`. What its callback does with the updated story
depends on who renders the page:

| App type                                                                                               | Callback                                       |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Reactive framework, including server-side rendering with hydration (Next.js, Nuxt, SvelteKit, Angular) | Store the story in component state             |
| Server-rendered HTML (Astro, server templates)                                                         | Pass the story to `createLivePreviewHandler()` |

- **Reactive frameworks:** the framework re-renders from state. Don't use
  `createLivePreviewHandler()` or `morphStoryblokDom()`: morphing the DOM fights the framework's own
  rendering.
- **Server-rendered apps:** the page has no client state to update. The handler asks your server to
  render the updated story and morphs the returned HTML into the page. See
  [Server-rendered setup](#server-rendered-setup).

Use `morphStoryblokDom()` directly only when you need the morph without the handler's debouncing and
cancellation. Use `loadStoryblokBridge()` directly only for custom event handling the shared bridge
doesn't cover.

`storyblokEditable()`, `editableField()`, and `isInEditor()` work with either approach.

## `onStoryblokEditorEvent()`

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
expects a synchronous teardown:

```svelte
<script lang="ts">
  import { onStoryblokEditorEvent } from "@storyblok/live-preview";

  let { data } = $props();
  let story = $derived(data.story);

  $effect(() => onStoryblokEditorEvent((newStory) => (story = newStory)));
</script>
```

```tsx
useEffect(() => onStoryblokEditorEvent(setStory, { resolveRelations: ["featured.articles"] }), []);
```

The Svelte example assigns to `$derived` state, which requires Svelte 5.25 or later.

Outside the Visual Editor or on the server, the call does nothing and returns a cleanup function
that does nothing.

### Events

The Preview Bridge emits three events. Each one maps to a fixed behavior:

| Event       | Trigger                       | Behavior                                      |
| ----------- | ----------------------------- | --------------------------------------------- |
| `input`     | An editor changes a field     | Calls `callback` with the updated story       |
| `change`    | An editor saves the story     | Reloads the page, or calls `options.onChange` |
| `published` | An editor publishes the story | Reloads the page, or calls `options.onChange` |

### Options

`LivePreviewOptions` extends the Preview Bridge options (`BridgeParams`) with two handlers:

| Option             | Type                                          | Description                                                                    |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `resolveRelations` | `string[]`                                    | Relations to resolve in the story payload, for example `["featured.articles"]` |
| `resolveLinks`     | `"url" \| "story" \| "0" \| "1"`              | Link resolution mode                                                           |
| `customParent`     | `string`                                      | Origin of the Visual Editor, for a self-hosted or regional editor              |
| `fallbackLang`     | `string`                                      | Fallback language for field-level translations                                 |
| `preventClicks`    | `boolean`                                     | Block link navigation inside the Visual Editor                                 |
| `onChange`         | `(event: StoryblokEditorChangeEvent) => void` | Called on `change` and `published` instead of reloading the page               |
| `onError`          | `(error: unknown) => void`                    | Called when the Preview Bridge fails to load. Defaults to `console.error`      |

### Saved and published changes

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

In Next.js, call `router.refresh()` instead. The page still reloads unless every active subscription
passes `onChange`, because every subscription shares one bridge.

### Errors

`onStoryblokEditorEvent()` never throws or rejects. A Preview Bridge load failure goes to `onError`,
including a later rebuild of the shared bridge that leaves the subscription without one. The
subscription is removed before `onError` runs, and `onError` isn't called for a subscription cleaned
up while the bridge was still loading. Without `onError`, the error is logged with `console.error`
once per failure, however many subscriptions it affects.

```ts
const stopListening = onStoryblokEditorEvent(
  (story) => {
    // update local state
  },
  { onError: (error) => reportToMonitoring(error) },
);
```

### Shared bridge

Every subscription on a page shares one Preview Bridge instance, because the Visual Editor supports
only one bridge configuration per page. The options of all active subscriptions are merged:

- **Relations:** `resolveRelations` values are combined.
- **Scalar options:** `customParent`, `resolveLinks`, and `fallbackLang` take the value of the
  earliest active subscription that sets them.
- **`preventClicks`:** `true` wins if any active subscription requests it.
- **`initOnlyOnce`:** always `false`.

A subscribe or cleanup rebuilds the bridge only when it changes the merged options. Subscriptions
made in the same synchronous tick, or while the bridge module is still loading, share one build. A
later change tears down the bridge and builds a new one, which briefly leaves the page without a
bridge. To avoid rebuilds, subscribe to all known options upfront, in the same tick.

A cleanup removes the subscription's options from the merge right away. A cleanup followed by an
immediate re-subscribe, such as React StrictMode or a Svelte `$effect` re-run, joins the build in
progress instead of starting a second one.

## `createLivePreviewHandler()`

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
reloading the page or calling `onChange`, so the handler's `onReload` doesn't run in this setup.

### Server-rendered setup

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

**Server:** the page's route renders the posted story instead of fetching it. Accept the `POST` only
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

- **Why these checks:** the `_storyblok` query parameters are public, so `isInEditor()` alone
  doesn't prove the request's origin. Requiring `application/json` forces a CORS preflight for
  cross-origin requests, and `Sec-Fetch-Site` rejects anything that isn't same-origin.
- **Untrusted body:** anyone can send this request. Use the posted story only to render the preview,
  never for IDs, permissions, or anything else the server relies on.
- **On-demand routes:** the route must render on request. A prerendered or static route can't answer
  the `POST`, usually with a 404 or 405. Reloading on save and publish still works there.
- **Interactive islands:** mark the root of a client-rendered component with `data-preserve-state`,
  so the morph leaves it intact.

### Options

| Option           | Type                                               | Description                                                                                 |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `currentRoot`    | `() => Element`                                    | Required. Returns the element to update                                                     |
| `update`         | `(context: { story, signal }) => Promise<Element>` | Required. Renders the story and returns the new root. Abort on `signal`                     |
| `debounceMs`     | `number`                                           | Delay before an `input` event triggers `update`. Defaults to `500`                          |
| `morph`          | `Omit<DomMorphOptions, "focusedElement">`          | Options passed to `morphStoryblokDom()`                                                     |
| `onBeforeUpdate` | `(story) => boolean \| void`                       | Called before an update. Return `false` to skip it                                          |
| `onUpdated`      | `(story) => void`                                  | Called after the morph                                                                      |
| `onError`        | `(error: unknown, story) => void`                  | Called when `update` or the morph fails. Defaults to `console.error`. Not called for aborts |
| `onReload`       | `(action: "change" \| "published") => void`        | Called on `change` and `published`. Defaults to `window.location.reload()`                  |

On `change` or `published`, a pending `input` update is cancelled before `onReload` runs, so stale
content can't overwrite the reload.

### Return value

| Member    | Type                       | Description                                                                   |
| --------- | -------------------------- | ----------------------------------------------------------------------------- |
| `handle`  | `(event) => Promise<void>` | Processes an event. Resolves once it's scheduled, not once the DOM is updated |
| `dispose` | `() => void`               | Cancels any pending update. Call it on teardown                               |

## `morphStoryblokDom()`

Morphs a new DOM tree into the current one. It doesn't fetch content or listen to Preview Bridge
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

When the Visual Editor has a block focused, only that block is morphed. The rest of `currentRoot`
stays as is until an update finds no focused block. Interactive form state (`value`, `checked`,
`selected`) that the user changed is preserved.

`morphStoryblokDom()` mutates `nextRoot`. Don't reuse or cache `nextRoot` afterward.

### Options

| Option                      | Type                                                  | Default                 | Description                                                                           |
| --------------------------- | ----------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `focusedElement`            | `Element \| null`                                     | Auto-detected           | The focused block. Pass `null` to morph the full root                                 |
| `keyAttribute`              | `string`                                              | `"data-blok-uid"`       | Attribute that matches the same block across both trees                               |
| `focusedAttribute`          | `string`                                              | `"data-blok-focused"`   | Attribute that marks the focused block                                                |
| `preserveStateAttribute`    | `string`                                              | `"data-preserve-state"` | Attribute that marks a subtree to skip entirely, for example a hydrated island        |
| `preserveElementAttributes` | `boolean`                                             | `false`                 | Keep the current attributes of every matched element instead of applying new ones     |
| `onBeforeElUpdated`         | `(fromEl: Element, toEl: Element) => boolean \| void` | —                       | Extra update policy, applied after the default one. Return `false` to skip an element |

### Return value

`DomMorphResult` has one field, `scope`: `"focused"` when only the focused block was morphed, or
`"root"` when the full root was.

## `loadStoryblokBridge()`

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

## `storyblokEditable()`

Returns the attributes that make a block selectable in the Visual Editor. Spread them onto the
block's root element.

```ts
function storyblokEditable(block?: { _editable?: string }): Record<string, string>;
```

```tsx
import { storyblokEditable } from "@storyblok/live-preview";

<section {...storyblokEditable(blok)}>{/* ... */}</section>;
```

It returns `{}` when the block has no valid `_editable` value, for example outside the Visual
Editor.

## `editableField()`

Returns the attribute that makes a single field selectable in the Visual Editor.

```ts
function editableField(field: string): EditableFieldAttributes | Record<string, never>;
```

```tsx
import { editableField } from "@storyblok/live-preview";

<h1 {...editableField("headline")}>{blok.headline}</h1>;
```

It returns `{}` for an empty field name.

## `isInEditor()`

Checks whether a URL is a Visual Editor request. It requires the `_storyblok`, `_storyblok_c`, and
`_storyblok_tk[space_id]` query parameters.

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

## `isBrowser()`

Returns `true` when the code runs in a browser.

```ts
function isBrowser(): boolean;
```

## Types

| Type                             | Description                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `LivePreviewOptions`             | Options for `onStoryblokEditorEvent()`                                                    |
| `LivePreviewStory<TStory>`       | Story payload from the Visual Editor. `id` is required; `uuid` and `content` are optional |
| `StoryblokEditorChangeEvent`     | The `change` or `published` event passed to `onChange`                                    |
| `LivePreviewHandler`             | Return value of `createLivePreviewHandler()`                                              |
| `LivePreviewHandlerOptions`      | Options for `createLivePreviewHandler()`                                                  |
| `LivePreviewEvent`               | Preview Bridge event accepted by `handler.handle()`                                       |
| `LivePreviewUpdateContext`       | Argument of the `update` option: `{ story, signal }`                                      |
| `DomMorphOptions`                | Options for `morphStoryblokDom()`                                                         |
| `DomMorphResult`                 | Return value of `morphStoryblokDom()`                                                     |
| `BridgeParams`                   | Preview Bridge options, re-exported from `@storyblok/preview-bridge`                      |
| `Story`, `Block`, `BlockContent` | Content Delivery API story and block types                                                |
