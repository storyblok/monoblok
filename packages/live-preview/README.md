<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/live-preview</h1>
 <p>
   Lightweight helpers to enable Storyblok Live Preview and Visual Editor
   updates across client-side and SSR frameworks.
 </p>
 <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/live-preview">
    <img src="https://img.shields.io/npm/v/@storyblok/live-preview/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Live Preview" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/live-preview" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/live-preview.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
</p>

## Installation

```bash
npm install @storyblok/live-preview
# or
yarn add @storyblok/live-preview
```

## Usage

### Live preview

Covers the most common live preview use cases with minimal setup.

```ts
import { onStoryblokEditorEvent } from "@storyblok/live-preview";

const stopListening = await onStoryblokEditorEvent((story) => {
  // update local state
});

// later — e.g. on component teardown
stopListening();
```

Every call on a page shares one bridge instance: relation options are unioned, and scalar options
(`customParent`, `resolveLinks`, `fallbackLang`) use first-wins semantics among the subscribers
currently active. `preventClicks` is the one exception: any active subscriber requesting `true` wins
regardless of subscribe order. Outside the Visual Editor, the call is a no-op and resolves to a
cleanup function that does nothing.

A subscribe or unsubscribe only rebuilds the shared bridge when the merged options actually change —
an already-covered relation, or an empty `{}`, does not. Calls made synchronously in the same tick
(or that arrive while the bridge module is still loading) share a single build; a call that lands
after that window triggers a full teardown and rebuild of the shared bridge instead, briefly leaving
the page with no attached bridge. Prefer batching known subscriptions upfront (e.g. with
`Promise.all`) when possible.

Cleaning up a subscription immediately stops its own options from being merged in, and — if other
subscriptions remain and the retraction changes the merge — rebuilds the live bridge to reflect it,
so a departed subscriber's `preventClicks`/relation/scalar contribution stops applying right away
rather than lingering until some unrelated future subscribe/unsubscribe.

### Low-level Preview Bridge access

For advanced use cases where full control is needed, the Preview Bridge can be accessed directly.

```ts
import { loadStoryblokBridge } from "@storyblok/live-preview";

const bridge = await loadStoryblokBridge(bridgeOptions);

bridge.on(["input", "change", "published"], (event) => {
  // custom preview handling
});
```

### Live preview handler

For framework integrations or custom renderers, use `createLivePreviewHandler` to provide the
content update strategy while the package handles debouncing, cancellation, and DOM updates.

```ts
import { createLivePreviewHandler } from "@storyblok/live-preview";

const handler = createLivePreviewHandler({
  currentRoot: () => document.body,
  update: async ({ story, signal }) => {
    const response = await fetch("/preview", {
      method: "POST",
      body: JSON.stringify({ story }),
      signal,
    });
    return new DOMParser().parseFromString(await response.text(), "text/html").body;
  },
});

storyblokInstance.on(["published", "change", "input"], handler.handle);
```

Failures from `update` or the morph are logged with `console.error` unless an `onError` callback is
provided. `change` and `published` events reload the page (`window.location.reload()`) unless an
`onReload` callback is provided; either way, a pending debounced `input` update is cancelled first
so it can't overwrite the reload with stale content.

For lower-level control, `morphStoryblokDom` only handles DOM transformation. It does not fetch
content or listen to Preview Bridge events.

```ts
import { morphStoryblokDom } from "@storyblok/live-preview";

morphStoryblokDom(document.body, nextBody, {
  focusedElement: document.querySelector('[data-blok-focused="true"]'),
});
```

When a focused block is found, only that subtree is morphed; everything else in `currentRoot` is
left untouched until an update finds no focused block, or the caller reloads. Attribute changes from
the server (new `src`, `href`, `class`, …) are applied by default; pass
`preserveElementAttributes: true` to keep the current tree's attributes instead. Interactive form
state (`value`, `checked`, `selected`) that the user has changed is preserved automatically;
elements nobody has touched still pick up a new server-rendered default. To protect a subtree a
framework owns (e.g. a hydrated island) from being touched at all — attributes and children — mark
its root with `data-preserve-state` (configurable via `preserveStateAttribute`); the morph skips it
entirely. `morphStoryblokDom` mutates `nextRoot`, so don't reuse or cache it after calling this
function.

## Documentation

This package is intentionally minimal. More helpers and examples will be added over time as usage
expands.

## Community

For help, best practices, or discussions:

- [Storyblok GitHub Discussions](https://github.com/storyblok/monoblok/discussions)
- [Join the Storyblok Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

## License

[MIT](/LICENSE)
