# @storyblok/svelte 8.x docs draft

Staged docs for the docs platform PR. Each section starts with a `target` marker naming the page it
belongs to:

- `svelte-sdk/index.mdx`: replace with the reference below. Move the current page to `v7.mdx` first
  and add it to "Previous versions". The current page's title says "Version 6.x", but it documents
  the `storyblokInit` API that 7.x still ships, so title the moved page "Version 7.x" (or "Version
  6.x-7.x").
- `svelte-sdk/migration-from-v7.mdx`: new page. No `libraries.ts` navigation entry: like the React
  and Astro migration guides, the reference page links to it.

<!-- target: src/content/docs/docs/libraries/js/svelte-sdk/index.mdx -->

````mdx
---
title: "@storyblok/svelte (Version 8.x)"
description: "@storyblok/svelte is Storyblok’s official SDK for Svelte applications."
---

import { Aside, LinkCard } from "@astrojs/starlight/components";

[@storyblok/svelte](https://github.com/storyblok/monoblok/tree/main/packages/svelte) is Storyblok’s
official SDK for Svelte applications.

<Aside type="caution">
  Version 8 is a breaking rewrite. It replaces `storyblokInit`, `useStoryblokApi`, and
  `StoryblokComponent` with a block registry built around `defineStoryblokBlocks`. To upgrade from
  version 7.x, follow the [migration guide](/docs/libraries/js/svelte-sdk/migration-from-v7).
</Aside>

Version 8 separates rendering from data fetching. Fetch content with your own client, such as
[`@storyblok/api-client`](/docs/libraries/js/content-delivery-api-client), and render it with the
`StoryblokBlock` component returned by `defineStoryblokBlocks`.

## Requirements

- **Svelte** version 5.25 or later
- **Node.js** LTS (version 22.x recommended)
- **Modern web browser** (for example, Chrome, Firefox, Safari, Edge—latest versions)

## Installation

Add the packages to a project by running this command in the terminal:

```bash
npm install @storyblok/svelte@latest @storyblok/api-client@latest
```

## Usage

The examples below use SvelteKit. The SDK itself has no SvelteKit dependency.

### Configuration

Create an `@storyblok/api-client` instance with the space’s access token, and register the Svelte
components that render your Storyblok blocks:

```ts title="src/lib/storyblok.ts"
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Page from "$lib/blocks/Page.svelte";
import Feature from "$lib/blocks/Feature.svelte";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => ({
  components: { page: Page, feature: Feature },
}));
```

<Aside type="tip">
  Learn how to retrieve an access token in the [access tokens
  concept](/docs/concepts/access-tokens).
</Aside>

<Aside type="caution">
  Set `region` to the region the space was created in. It defaults to `eu`. Learn more in the
  [@storyblok/api-client reference](/docs/libraries/js/content-delivery-api-client).
</Aside>

### Components

Create a Svelte component for each block and register it in `defineStoryblokBlocks`. Each component
receives the block content as `block`, and its Visual Editor attributes as `editable`. Spread
`editable` onto the component’s root element to make the block selectable in the Visual Editor.

```svelte title="src/lib/blocks/Feature.svelte"
<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block, editable }: StoryblokBlockComponentProps<{ name: string }> = $props();
</script>

<div {...editable}>
  <h2>{block.name}</h2>
</div>
```

To render nested blocks, import `StoryblokBlock` from the module that calls `defineStoryblokBlocks`:

```svelte title="src/lib/blocks/Page.svelte"
<script lang="ts">
  import type { StoryblokBlockComponentProps, StoryblokBlockData } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  const { block, editable }: StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }> =
    $props();
</script>

<main {...editable}>
  {#each block.body as nestedBlock (nestedBlock._uid)}
    <StoryblokBlock block={nestedBlock} />
  {/each}
</main>
```

### Fetching and rendering

Fetch a story in a `load` function:

```ts title="src/routes/[...slug]/+page.ts"
import { error } from "@sveltejs/kit";
import { apiClient } from "$lib/storyblok";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const { data } = await apiClient.stories.get(params.slug || "home", {
    query: { version: "draft" },
  });
  if (!data) error(404, "Story not found");

  return { story: data.story };
};
```

Render the story’s content with `StoryblokBlock`, and subscribe to Visual Editor changes with
`onStoryblokEditorEvent`:

```svelte title="src/routes/[...slug]/+page.svelte"
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  let { data } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  $effect(() =>
    onStoryblokEditorEvent((newStory) => (story = newStory), {
      onChange: () => invalidateAll(),
    }),
  );
</script>

<StoryblokBlock block={story.content} />
```

## API

### `defineStoryblokBlocks`

`defineStoryblokBlocks()` registers the components that render Storyblok blocks and returns the
`StoryblokBlock` and `StoryblokRichText` components bound to them.

```ts
const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks<TExtraProps>(() => OPTIONS);
```

`defineStoryblokBlocks()` takes a function that returns the options, not the options object. Block
components that render nested blocks import `StoryblokBlock` back from the same module, which
creates an import cycle. The function runs on the first render, after the cycle has finished
loading.

| Key          | Description                                                                                                                   | Type      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| `components` | An object that maps the technical names of Storyblok blocks to Svelte components.                                             | `object`  |
| `fallback`   | A component rendered for block types that `components` doesn’t include. It receives the same props as a registered component. | `object`  |
| `warnings`   | Logs a warning when `StoryblokBlock` renders nothing. Defaults to `true`. Set it to `false` to silence the warnings.          | `boolean` |

Each call creates an independent registry. Nothing is shared globally, so an app can define one
registry per content area without the registries overwriting each other.

#### Unregistered blocks

A content editor can add a block type that no component is registered for. `StoryblokBlock` then
renders the `fallback`, or, without one, renders nothing and logs a warning. The warning is logged
in development and production, so missing content shows up in your logs. Each registry logs the
warning once per block type for the lifetime of the process, so a server logs it once per
deployment, not once per request.

To silence the warnings of a registry, set `warnings` to `false`:

```ts
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
  warnings: false,
}));
```

#### Extra props

Pass a type argument to declare props that `StoryblokBlock` forwards to every registered component:

```ts
export const { StoryblokBlock } = defineStoryblokBlocks<{ locale: string }>(() => ({
  components: { page: Page },
}));
```

```svelte
<StoryblokBlock block={story.content} locale="fr" />
```

A registered component can only require props declared in the type argument. The `block` and
`editable` names are reserved.

### `StoryblokBlock`

`StoryblokBlock` renders a block with the component registered for its `component` field. Pass the
block as the `block` prop, and any extra props declared in `defineStoryblokBlocks`.

```svelte
<StoryblokBlock block={story.content} />
```

The registered component receives:

| Prop       | Description                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `block`    | The block content.                                                                                |
| `editable` | The block’s Visual Editor attributes. Spread them onto the component’s root element.              |
| Extra      | The props declared in the `defineStoryblokBlocks` type argument, forwarded from `StoryblokBlock`. |

`StoryblokBlock` renders nothing for an undefined `block`, and logs a warning unless the registry
sets `warnings` to `false`. In the Visual Editor, `story.content` is `undefined` while the editor
shows a previous version of the story (visual history), so `StoryblokBlock` skips the warning there.

### `storyblokEditable`

`storyblokEditable()` takes a block and returns the attributes that make an element editable in the
Visual Editor. Registered components receive the same attributes as the `editable` prop. Use
`storyblokEditable()` for elements outside a registered component:

```svelte
<section {...storyblokEditable(block)}>{block.headline}</section>
```

### `editableField`

`editableField()` takes a field name and returns the attributes that link an element to that field
in the Visual Editor:

```svelte
<h2 {...editableField('headline')}>{block.headline}</h2>
```

### `onStoryblokEditorEvent`

`onStoryblokEditorEvent()` loads the Storyblok Bridge and calls a callback with the updated story
whenever an editor changes content in the Visual Editor. It returns an unsubscribe function right
away, so it can be returned from `$effect`. Outside the Visual Editor and on the server, the
function does nothing.

```ts
$effect(() => onStoryblokEditorEvent(CALLBACK, OPTIONS));
```

All [Storyblok Bridge options](/docs/libraries/js/preview-bridge) are available, such as
`resolveRelations` and `resolveLinks`. Pass the same values you use to fetch the story, so updated
content keeps its resolved relations and links. The following additional options are available:

| Key        | Description                                                                                                                                          | Type       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `onChange` | Called when the story is saved or published, instead of reloading the page. In SvelteKit, pass `() => invalidateAll()` to rerun the `load` function. | `function` |
| `onError`  | Called if the Storyblok Bridge fails to load. Without it, the error is logged.                                                                       | `function` |

The callback receives every story the Visual Editor sends, not only the story of the current page.
All subscriptions on a page share one Storyblok Bridge, so the page reloads on save unless every
subscription passes `onChange`.

### `loadStoryblokBridge`

`loadStoryblokBridge()` loads the Storyblok Bridge and returns a new bridge instance. Use it to
listen to events that `onStoryblokEditorEvent()` doesn’t handle.

```ts
const bridge = await loadStoryblokBridge(BRIDGE_OPTIONS);
bridge.on("enterEditmode", () => {
  // ...
});
```

### `isInEditor`

`isInEditor()` takes a URL and returns `true` if the request comes from the Visual Editor. Pass a
`spaceId` option to also check that the request belongs to that space.

```ts
export const load: PageLoad = async ({ url }) => {
  const version = isInEditor(url) ? "draft" : "published";
  // ...
};
```

### `StoryblokRichText`

`StoryblokRichText` renders a rich text field from a Storyblok story. Use the `StoryblokRichText`
returned by `defineStoryblokBlocks()`: it renders embedded blocks through the same registry as
`StoryblokBlock`.

```svelte
<script lang="ts">
  import { StoryblokRichText } from '$lib/storyblok';
</script>

<StoryblokRichText document={block.richtext_field} />
```

The component accepts the following optional props:

- `components`: custom Svelte components for supported rich text nodes and marks.
- `optimizeImage`: image optimization options for image nodes.
- `data`: custom data passed to custom components through `context`. A plain object is also passed
  to every embedded block as extra props.
- `warnings`: logs a warning for embedded blocks that render nothing. Defaults to `true`. Set it to
  `false` to silence these warnings for this field, even when the registry's `warnings` is `true`.

See the [@storyblok/richtext reference](/docs/libraries/js/rich-text) for a complete list of
supported nodes, marks, and customization options.

#### Custom components

Register custom components with the `components` prop. Each key must match a supported rich text
node or mark name.

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextComponentMap } from '@storyblok/svelte';
  import { StoryblokRichText } from '$lib/storyblok';
  import CustomHeading from './CustomHeading.svelte';
  import CustomLink from './CustomLink.svelte';

  const components: StoryblokSvelteRichTextComponentMap = {
    heading: CustomHeading,
    link: CustomLink,
  };
</script>

<StoryblokRichText document={block.richtext_field} {components} />
```

<Aside type="tip">
  `StoryblokSvelteRichTextProps<T>` types the props of a custom component. For example, `StoryblokSvelteRichTextProps<'link'>` provides the attributes
  of the `link` mark, and `StoryblokSvelteRichTextProps<'heading'>` provides heading attributes such as `level`.
</Aside>

#### Example: custom link component (mark)

Marks receive their rendered child content through Svelte’s `{@render ...}` tag.

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';

  const props: StoryblokSvelteRichTextProps<'link'> = $props();
</script>

<a href={props.attrs?.href ?? ''} target={props.attrs?.target ?? '_self'}>
  {@render props.children?.()}
</a>
```

#### Example: custom heading component (node)

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';

  const props: StoryblokSvelteRichTextProps<'heading'> = $props();
  const tag = $derived(`h${props.attrs?.level ?? 1}`);
</script>

<svelte:element this={tag}>
  {@render props.children?.()}
</svelte:element>
```

#### Example: custom table component (advanced node)

Nodes can access `content` and `context` to render child nodes with `StoryblokRichText`. The
`splitTableRows` utility from `@storyblok/richtext` separates header rows from body rows.

```svelte
<script lang="ts">
  import { splitTableRows } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  import { StoryblokRichText } from '$lib/storyblok';

  const props: StoryblokSvelteRichTextProps<'table'> = $props();
  const { headerRows, bodyRows } = $derived(splitTableRows(props.content));
</script>

<table>
  {#if headerRows}
    <thead>
      <StoryblokRichText document={headerRows} {...props.context} />
    </thead>
  {/if}
  <tbody>
    <StoryblokRichText document={bodyRows} {...props.context} />
  </tbody>
</table>
```

#### Embedded blocks

The `StoryblokRichText` returned by `defineStoryblokBlocks()` renders embedded blocks with the
registered components, including their `editable` attributes and the `fallback`. To pass the extra
props declared in `defineStoryblokBlocks<TExtraProps>()` to embedded blocks, pass them as `data`:

```svelte
<StoryblokRichText document={block.text} data={{ locale }} />
```

`StoryblokRichText` accepts any `data` value, so the type checker doesn’t catch a missing or
misspelled extra prop, and the embedded block receives `undefined`. To check `data` against the
extra props, export their type from the module that calls `defineStoryblokBlocks()`:

```ts title="src/lib/storyblok.ts"
export type ExtraProps = { locale: string };

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks<ExtraProps>(() => ({
  components: { page: Page },
}));
```

Then mark `data` with `satisfies`:

```svelte
<StoryblokRichText document={block.text} data={{ locale } satisfies ExtraProps} />
```

To render embedded blocks differently, pass a `components.blok` renderer. It replaces the default
renderer and receives the embedded blocks as `attrs.body`.

#### Standalone component

`@storyblok/svelte` also exports a `StoryblokRichText` that isn’t bound to a block registry, for
full control over rendering. It renders embedded blocks only through a `components.blok` renderer.
Without one, embedded blocks render nothing and log a warning. To silence the warning, pass
`warnings={false}`.

```svelte
<script lang="ts">
  import { StoryblokRichText } from '@storyblok/svelte';
  import Blok from '$lib/richtext/Blok.svelte';
</script>

<StoryblokRichText document={block.text} components={{ blok: Blok }} />
```

### Types

The SDK exports the following types for block components:

| Type                           | Description                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `StoryblokBlockComponentProps` | Props of a registered component. Pass the block’s fields as a type argument: `StoryblokBlockComponentProps<{ headline: string }>`. |
| `StoryblokBlockData`           | A block from the Content Delivery API. Without a type argument, its fields are typed as `unknown`.                                 |
| `StoryblokComponentMap`        | The `components` object passed to `defineStoryblokBlocks`.                                                                         |
| `LivePreviewStory`             | The story passed to the `onStoryblokEditorEvent` callback.                                                                         |

## Further resources

<LinkCard
  description="See the repository playground for additional examples."
  href="https://github.com/storyblok/monoblok/tree/main/packages/svelte/playground"
  title="Repository Playground"
/>
<LinkCard
  description="Upgrade an application from @storyblok/svelte 7.x."
  href="/docs/libraries/js/svelte-sdk/migration-from-v7"
  title="Migrate to @storyblok/svelte 8.x"
/>
<LinkCard
  description="See the core space blueprint for Svelte to kickstart a new project."
  href="https://github.com/storyblok/blueprint-core-svelte"
  title="Space Blueprint: Svelte"
/>

## Previous versions

<LinkCard href="/docs/libraries/js/svelte-sdk/v7" title="@storyblok/svelte (Version 7.x)" />
<LinkCard href="/docs/libraries/js/svelte-sdk/v5" title="@storyblok/svelte (Version 5.x)" />
````

<!-- target: src/content/docs/docs/libraries/js/svelte-sdk/migration-from-v7.mdx -->

````mdx
---
title: "Migrate to @storyblok/svelte 8.x"
description: "Upgrade a Svelte application from @storyblok/svelte 7.x to 8.x."
topic: libraries
---

import { Steps, TabItem, Tabs } from "@astrojs/starlight/components";

`@storyblok/svelte` 8.x is a redesign of the SDK. Version 8.x:

- Removes the global `storyblokInit()` client and component registry.
- Moves data fetching to the framework-agnostic
  [`@storyblok/api-client`](/docs/libraries/js/content-delivery-api-client).
- Replaces `StoryblokComponent` with a scoped block registry, `defineStoryblokBlocks()`.

This guide explains how to update the initialization, data fetching, and block components of an app
that uses `@storyblok/svelte` 7.x.

## Requirements

- **Svelte** version 5.25 or later (version 8.x drops support for Svelte 5.0-5.24)
- **Node.js** LTS (version 22.x recommended)

## Migration steps

Follow these steps to migrate an application:

<Steps>

1. [Upgrade](#update-the-packages) `@storyblok/svelte` and add `@storyblok/api-client`.
2. [Create one API client](#create-the-api-client) and move the options of `storyblokInit()` to
   `createApiClient()`. Replace `useStoryblokApi()` and `getStoryblokApi()` calls with
   `apiClient.stories.get()`.
3. [Replace `storyblokInit({ components })`](#register-blocks) with `defineStoryblokBlocks()`, and
   `StoryblokComponent` with the `StoryblokBlock` it returns.
4. [Rename `blok` to `block`](#update-block-components) in every block component, and replace
   `use:storyblokEditable` with the `editable` prop.
5. [Replace `useStoryblokBridge()`](#update-live-preview) with `onStoryblokEditorEvent()`.
6. [Import `StoryblokRichText`](#update-rich-text) from the module that calls
   `defineStoryblokBlocks()`.
7. [Update type and helper imports](#update-imports).

</Steps>

## Summary of changes

Version 8.x has no global client or component registry. The following tables list the APIs that
version 8.x removes and changes.

### Removed

| Removed in version 8.x                                                       | Replacement                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `storyblokInit()`, `apiPlugin`, `useStoryblokApi()`, `getStoryblokApi()`     | `defineStoryblokBlocks()`, and `createApiClient()` from `@storyblok/api-client` |
| `StoryblokComponent`, `getComponent()`                                       | The `StoryblokBlock` returned by `defineStoryblokBlocks()`                      |
| `useStoryblokBridge()`                                                       | `onStoryblokEditorEvent()`                                                      |
| The `storyblokEditable` Svelte action                                        | The `editable` prop, or `{...storyblokEditable(block)}`                         |
| The `storyblok__outline` class                                               | None. Style editable elements in your application.                              |
| `renderRichText`, `buildStoryblokImage`, `splitTableRows`, and other helpers | Import them from `@storyblok/richtext`                                          |

### Changed

| API                       | Version 7.x                                    | Version 8.x                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Block component prop      | `blok`                                         | `block`, plus `editable`                                                                                                                                                                            |
| `storyblokEditable`       | Svelte action (`use:storyblokEditable`)        | Function that returns attributes (`{...storyblokEditable(block)}`)                                                                                                                                  |
| Unregistered block types  | Rendered nothing and logged an error           | Render `fallback`, or nothing and log a warning once per block type                                                                                                                                 |
| Embedded rich text blocks | Rendered through the global component registry | Rendered through the registry of the `StoryblokRichText` returned by `defineStoryblokBlocks()`. The `StoryblokRichText` exported by `@storyblok/svelte` renders them only through `components.blok` |
| Save and publish          | Reload the page                                | Reload the page, or call `onChange`                                                                                                                                                                 |
| Svelte peer dependency    | `^5.0.0`                                       | `^5.25.0`                                                                                                                                                                                           |

## Update the packages

Upgrade `@storyblok/svelte` and add `@storyblok/api-client` to the project:

```bash
npm install @storyblok/svelte@latest @storyblok/api-client@latest
```

## Create the API client

Replace `storyblokInit()` and `apiPlugin` with `@storyblok/api-client`. Create one client instance
and export it next to the block registry.

<Tabs>
  <TabItem label="Version 8.x">

```ts title="src/lib/storyblok.ts"
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Page from "$lib/blocks/Page.svelte";
import Feature from "$lib/blocks/Feature.svelte";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "us",
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page, feature: Feature },
}));
```

  </TabItem>
  <TabItem label="Version 7.x">

```js title="src/routes/+layout.js"
import { apiPlugin, getStoryblokApi, storyblokInit } from "@storyblok/svelte";
import Page from "$lib/blocks/Page.svelte";
import Feature from "$lib/blocks/Feature.svelte";

export function load() {
  storyblokInit({
    accessToken: "YOUR_ACCESS_TOKEN",
    apiOptions: { region: "us" },
    use: [apiPlugin],
    components: { page: Page, feature: Feature },
  });
  return { storyblokApi: getStoryblokApi() };
}
```

  </TabItem>
</Tabs>

The options of `storyblokInit()` map to version 8.x as follows:

| `storyblokInit()` option                                       | Version 8.x                                                                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`                                                  | `createApiClient({ accessToken })`                                                                                                                                                           |
| `apiOptions.region`                                            | `createApiClient({ region })`                                                                                                                                                                |
| `apiOptions.endpoint`                                          | `createApiClient({ baseUrl })`, without the `/v2` path                                                                                                                                       |
| `apiOptions.cache`, `headers`, `timeout`, `rateLimit`, `fetch` | The `createApiClient()` options of the same name. `cache` and `rateLimit` take a different shape: see the [@storyblok/api-client reference](/docs/libraries/js/content-delivery-api-client). |
| `use: [apiPlugin]`                                             | Not needed                                                                                                                                                                                   |
| `components`                                                   | `defineStoryblokBlocks(() => ({ components }))`                                                                                                                                              |
| `bridge`                                                       | Not needed. The Storyblok Bridge loads only where the app calls `onStoryblokEditorEvent()`. To disable it, don’t call that function.                                                         |
| `bridgeUrl`                                                    | No replacement. The Storyblok Bridge ships with the SDK as an npm dependency.                                                                                                                |

Fetch stories from `apiClient` wherever the app called `useStoryblokApi()` or `getStoryblokApi()`:

<Tabs>
  <TabItem label="Version 8.x">

```ts title="src/routes/[...slug]/+page.ts"
import { error } from "@sveltejs/kit";
import { apiClient } from "$lib/storyblok";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const { data } = await apiClient.stories.get(params.slug || "home", {
    query: { version: "draft" },
  });
  if (!data) error(404, "Story not found");

  return { story: data.story };
};
```

  </TabItem>
  <TabItem label="Version 7.x">

```js title="src/routes/[...slug]/+page.js"
export async function load({ params, parent }) {
  const { storyblokApi } = await parent();
  const { data } = await storyblokApi.get(`cdn/stories/${params.slug || "home"}`, {
    version: "draft",
  });

  return { story: data.story };
}
```

  </TabItem>
</Tabs>

`apiClient.stories.get()` takes the slug without the `cdn/stories/` prefix, and API parameters such
as `version` go in the `query` object. By default, the client returns `{ data, error }` instead of
throwing. Pass `throwOnError: true` to `createApiClient()` to throw instead.

## Register blocks

`defineStoryblokBlocks()` replaces the `components` option of `storyblokInit()`. It takes a function
that returns the options, and returns a `StoryblokBlock` component bound to the registered
components. Render content with that `StoryblokBlock` instead of `StoryblokComponent`:

<Tabs>
  <TabItem label="Version 8.x">

```svelte
<script lang="ts">
  import { StoryblokBlock } from '$lib/storyblok';

  let { data } = $props();
</script>

<StoryblokBlock block={data.story.content} />
```

  </TabItem>
  <TabItem label="Version 7.x">

```svelte
<script>
  import { StoryblokComponent } from '@storyblok/svelte';

  let { data } = $props();
</script>

<StoryblokComponent blok={data.story.content} />
```

  </TabItem>
</Tabs>

A content editor can add a block type that no component is registered for. `StoryblokBlock` then
renders the `fallback`, or, without one, renders nothing and logs a warning, in development and
production. To silence the warnings, set `warnings: false` in `defineStoryblokBlocks()`. To control
what renders instead, provide a `fallback`. It receives the same props as a registered component:

```ts
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
  fallback: UnknownBlock,
}));
```

To pass extra props to every registered component, declare them in a type argument:
`defineStoryblokBlocks<{ locale: string }>()`. The `block` and `editable` names are reserved.

## Update block components

Registered components receive the block content as `block` instead of `blok`, and their Visual
Editor attributes as `editable`. Spread `editable` onto the root element instead of using
`use:storyblokEditable`. Render nested blocks with the `StoryblokBlock` from your registry module.

<Tabs>
  <TabItem label="Version 8.x">

```svelte title="src/lib/blocks/Page.svelte"
<script lang="ts">
  import type { StoryblokBlockComponentProps, StoryblokBlockData } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  const { block, editable }: StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }> =
    $props();
</script>

<main {...editable}>
  {#each block.body as nestedBlock (nestedBlock._uid)}
    <StoryblokBlock block={nestedBlock} />
  {/each}
</main>
```

  </TabItem>
  <TabItem label="Version 7.x">

```svelte title="src/lib/blocks/Page.svelte"
<script>
  import { StoryblokComponent, storyblokEditable } from '@storyblok/svelte';

  let { blok } = $props();
</script>

<main use:storyblokEditable={blok}>
  {#each blok.body as nestedBlok (nestedBlok._uid)}
    <StoryblokComponent blok={nestedBlok} />
  {/each}
</main>
```

  </TabItem>
</Tabs>

A component that still reads `blok` receives `undefined` and throws when it accesses a field.

`storyblokEditable` is no longer a Svelte action. It takes a block and returns its Visual Editor
attributes. `use:storyblokEditable={block}` passes the DOM node instead of the block and adds no
attributes. `svelte-check` reports this usage as a type error. To make an element editable outside a
registered component, spread the attributes:

```svelte
<section {...storyblokEditable(block)}>{block.headline}</section>
```

Version 8.x no longer adds the `storyblok__outline` class. Provide any visual editing styles in your
application.

## Update live preview

Replace `useStoryblokBridge()` with `onStoryblokEditorEvent()`. The function loads the Storyblok
Bridge, returns an unsubscribe function, and does nothing outside the Visual Editor. Return the
unsubscribe function from `$effect`, so Svelte calls it when the component is destroyed, even while
the Storyblok Bridge is still loading.

<Tabs>
  <TabItem label="Version 8.x">

```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  let { data } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  $effect(() =>
    onStoryblokEditorEvent((newStory) => (story = newStory), {
      resolveRelations: ['featured-articles.posts'],
      onChange: () => invalidateAll(),
    }),
  );
</script>

<StoryblokBlock block={story.content} />
```

  </TabItem>
  <TabItem label="Version 7.x">

```svelte
<script>
  import { onMount } from 'svelte';
  import { StoryblokComponent, useStoryblokBridge } from '@storyblok/svelte';

  let { data } = $props();
  let story = $state(data.story);

  onMount(() => {
    useStoryblokBridge(story.id, (newStory) => (story = newStory), {
      resolveRelations: ['featured-articles.posts'],
    });
  });
</script>

<StoryblokComponent blok={story.content} />
```

  </TabItem>
</Tabs>

Assigning to `$derived` requires Svelte 5.25 or later.

Pass the same `resolveRelations` and `resolveLinks` values you use to fetch the story, so updated
content keeps its resolved relations and links. Unlike `useStoryblokBridge()`, the callback doesn’t
filter by story ID: it receives every story the Visual Editor sends. If the Storyblok Bridge fails
to load, the function logs the error. Pass an `onError` option to handle the error instead.

When the story is saved or published, the page reloads. The `onChange` option replaces the reload,
here with SvelteKit’s `invalidateAll()`, which reruns the `load` function. All subscriptions on a
page share one Storyblok Bridge, so the page still reloads unless every subscription passes
`onChange`.

`story.content` is `undefined` while the Visual Editor shows a previous version of the story (visual
history). `StoryblokBlock` renders nothing for an undefined `block`.

## Update rich text

`defineStoryblokBlocks()` returns a `StoryblokRichText` component that renders embedded blocks
through the same registry as `StoryblokBlock`. Version 7.x rendered them through the global
component registry. Import `StoryblokRichText` from the module that calls `defineStoryblokBlocks()`
instead of from `@storyblok/svelte`:

<Tabs>
  <TabItem label="Version 8.x">

```svelte
<script lang="ts">
  import type { StoryblokBlockComponentProps, StoryblokRichTextInput } from '@storyblok/svelte';
  import { StoryblokRichText } from '$lib/storyblok';

  const { block, editable }: StoryblokBlockComponentProps<{ text: StoryblokRichTextInput }> =
    $props();
</script>

<article {...editable}>
  <StoryblokRichText document={block.text} />
</article>
```

  </TabItem>
  <TabItem label="Version 7.x">

```svelte
<script>
  import { StoryblokRichText, storyblokEditable } from '@storyblok/svelte';

  let { blok } = $props();
</script>

<article use:storyblokEditable={blok}>
  <StoryblokRichText document={blok.text} />
</article>
```

  </TabItem>
</Tabs>

`@storyblok/svelte` still exports a standalone `StoryblokRichText`. It isn’t bound to a block
registry, so embedded blocks render nothing and log a warning unless you pass a `components.blok`
renderer.

## Update imports

The following exports are no longer available:

- `StoryblokClient`, `ISbStoryData`, `ISbStory`, `ISbStoryParams`, `ISbStories`, `ISbStoriesParams`,
  `ISbResult`, `ISbManagmentApiResult`, `ISbCache`, `ISbConfig`, and `ISbAlternateObject`: import
  `Story` and the request types from `@storyblok/api-client`.
- `SbSDKOptions` and `SbSvelteSDKOptions`: configure `createApiClient()` with its typed options.
- `SbSvelteComponentsMap`: use `StoryblokComponentMap`.
- `StoryblokComponentProps`: use `StoryblokBlockComponentProps`.
- `SbBlokData`, `SbBlokKeyDataTypes`, and `StoryblokComponentType`: use `StoryblokBlockData`.
- `StoryblokBridgeV2` and `StoryblokBridgeConfigV2`: use `loadStoryblokBridge()` and the
  `BridgeParams` type.
- `SbSvelteRichTextComponentMap`, `SbSvelteRichTextProps`, and `SbSvelteRichTextRenderContext`: use
  the `StoryblokSvelteRichText*` types.
- `SbRichTextDoc`, `SbRichTextElement`, `SbRichTextImageOptions`, `SbRichTextInput`,
  `SbRichTextMark`, `SbRichTextNode`, `SbRichTextProps`, `SbRichTextRenderContext`,
  `SbRichTextTextNode`, and `RenderSpec`: use the `StoryblokRichText*` types.
- `renderRichText`, `buildStoryblokImage`, `splitTableRows`, `attrsToHtmlString`, `getInnerMarks`,
  `getStaticChildren`, `groupLinkNodes`, `hasContent`, `isSelfClosing`, `normalizeNodes`,
  `processAttrs`, `resolveTag`, and `styleToString`: import these helpers from
  `@storyblok/richtext`.
````
