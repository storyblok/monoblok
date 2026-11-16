---
title: "@storyblok/astro"
description:
  "@storyblok/astro renders Storyblok content in Astro with a block registry, and connects pages to
  the Visual Editor for live preview."
---

# @storyblok/astro

[@storyblok/astro](https://github.com/storyblok/monoblok/tree/main/packages/astro) renders Storyblok
content in Astro. It maps Storyblok blocks to Astro components with a block registry, and connects
pages to the [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor) for live
preview.

The package doesn’t fetch content. Fetch stories with your own client, such as
[@storyblok/api-client](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client),
and render them with the `StoryblokBlock` component returned by `defineStoryblokBlocks()`.

## Requirements

- **Astro** version 5, 6, or 7
- **Evergreen web browser** (for example, Chrome, Firefox, Safari, or Edge)

## Installation

Add the package and a Content Delivery API client to a project by running this command in the
terminal:

```bash
npm install @storyblok/astro @storyblok/api-client
```

## Usage

Set up the API client and the block registry, create the block components, and render a story.

### Configuration

Create an `@storyblok/api-client` instance with the space’s access token, and register the Astro
components that render your Storyblok blocks:

```ts
// src/storyblok.ts
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/astro";
import Feature from "./components/Feature.astro";
import Page from "./components/Page.astro";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks(() => ({
  components: {
    page: Page,
    feature: Feature,
  },
}));
```

Learn how to retrieve an access token in the
[access tokens concept](https://www.storyblok.com/docs/concepts/access-tokens). Specify the `region`
parameter unless you created the space in the EU.

### Components

Create an Astro component for each registered block. Each component receives a `block` prop with the
block’s content and an `editable` prop. Spread `editable` onto the root element to make the block
selectable in the Visual Editor:

```astro
---
// src/components/Feature.astro
const { block, editable } = Astro.props;
---

<div {...editable}>
  <h2>{block.headline}</h2>
</div>
```

Register only Astro (`.astro`) components. To render a block with a framework component, such as
React or Vue, wrap it in an Astro component and apply the `client:*` directive there.

Render nested blocks with the `StoryblokBlock` component from the same registry:

```astro
---
// src/components/Page.astro
import type { StoryblokBlockData } from "@storyblok/astro";
import { StoryblokBlock } from "../storyblok";

const { block, editable } = Astro.props;
---

<main {...editable}>
  {block.body?.map((child: StoryblokBlockData) => <StoryblokBlock block={child} />)}
</main>
```

### Fetching and rendering

Fetch a story with the API client and render its content with `StoryblokBlock`:

```astro
---
// src/pages/index.astro
import { apiClient, StoryblokBlock } from "../storyblok";

const { data } = await apiClient.stories.get("home", {
  query: { version: "draft" },
});

const story = data?.story;

if (!story) {
  return new Response(null, { status: 404 });
}
---

<StoryblokBlock block={story.content} />
```

To enable live editing in the Visual Editor, add
[`storyblokPreviewMiddleware`](#storyblokpreviewmiddleware) and render
[`StoryblokPreview`](#storyblokpreview) on the page. Learn more in [Live preview](#live-preview).

## API

`@storyblok/astro` exports the following components, middleware, and functions from the package
root.

| Export                                                      | Description                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`defineStoryblokBlocks`](#definestoryblokblocks)           | Creates a block registry and returns the `StoryblokBlock` and `StoryblokRichText` components bound to it. |
| [`StoryblokPreview`](#storyblokpreview)                     | Connects the page to the Visual Editor.                                                                   |
| [`storyblokPreviewMiddleware`](#storyblokpreviewmiddleware) | Captures the Visual Editor’s preview payload for `getPayload()`.                                          |
| [`getPayload`](#getpayload)                                 | Reads the preview story and server data during a live preview update.                                     |
| [`StoryblokServerData`](#storyblokserverdata)               | Passes server-side data to live preview updates.                                                          |
| [`StoryblokRichText`](#storyblokrichtext)                   | Renders a rich text field without a block registry.                                                       |
| [`storyblokEditable`](#storyblokeditable)                   | Returns the attributes that make a block selectable in the Visual Editor.                                 |
| [`editableField`](#editablefield)                           | Returns the attribute that makes a field selectable in the Visual Editor.                                 |
| [`isInEditor`](#isineditor)                                 | Checks whether a URL is a Visual Editor request.                                                          |
| [`sanitizeJSON`](#sanitizejson)                             | Serializes data to JSON that is safe to embed in HTML.                                                    |

### `defineStoryblokBlocks()`

Creates a block registry and returns the `StoryblokBlock` and `StoryblokRichText` components bound
to it.

```ts
function defineStoryblokBlocks<TExtraProps extends StoryblokExtraProps = {}>(
  factory: () => DefineStoryblokBlocksOptions<TExtraProps>,
): DefineStoryblokBlocksResult<TExtraProps>;
```

```ts
import { defineStoryblokBlocks } from "@storyblok/astro";

type ExtraProps = { locale?: string };

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks<ExtraProps>(() => ({
  components: {
    page: Page,
    feature: Feature,
    "featured-articles": FeaturedArticles,
  },
  fallback: FallbackBlock,
}));
```

The factory’s return value accepts the following properties:

| Key          | Description                                                                                                                                                                                      | Type                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `components` | Map of Storyblok technical block names to the Astro components that render them.                                                                                                                 | `StoryblokComponentMap`   |
| `fallback`   | Rendered for block types with no entry in `components`. Receives the same props as a registered component.                                                                                       | `StoryblokBlockComponent` |
| `warnings`   | Logs a warning when `StoryblokBlock` renders nothing: for an undefined `block`, an unregistered block type without `fallback`, or a component that isn’t an Astro component. Defaults to `true`. | `boolean`                 |

Each warning prints once per registry. Without a `fallback`, an unregistered block type renders
nothing.

The optional `TExtraProps` type argument declares extra props that `StoryblokBlock` accepts and
forwards to every registered component (`locale` above). A required property makes every
`StoryblokBlock` usage, including nested ones, supply it.

Each call creates an independent registry. To use separate component maps, for example one per
content area, call `defineStoryblokBlocks()` more than once.

#### Typed block components

Type the props of a block component with `StoryblokBlockComponentProps`. The first type argument
describes the block’s fields, and the second describes the extra props:

```astro
---
import type { StoryblokBlockComponentProps } from "@storyblok/astro";

type Props = StoryblokBlockComponentProps<{ headline: string }, { locale?: string }>;

const { block, editable, locale } = Astro.props;
---

<div {...editable} lang={locale}>
  <h2>{block.headline}</h2>
</div>
```

To register every component in a folder, use
[Vite’s `import.meta.glob`](https://vite.dev/guide/features#glob-import) to import them.

#### `StoryblokBlock`

Renders a single block with the component registered for its type, and forwards any extra props to
that component. When `block` has no value, for example `story?.content` after a failed fetch,
`StoryblokBlock` renders nothing and logs a warning outside the Visual Editor.

```astro
<StoryblokBlock block={story.content} />
```

#### Registry-bound `StoryblokRichText`

Renders a rich text field and renders its embedded blocks through the same registry as
`StoryblokBlock`. It accepts the same props as the package-root
[`StoryblokRichText`](#storyblokrichtext).

```astro
---
import { StoryblokRichText } from "../storyblok";

const { block } = Astro.props;
---

<StoryblokRichText document={block.text} />
```

A plain-object `data` prop is also passed to every embedded block as extra props. TypeScript doesn’t
check `data` against `TExtraProps`. To check it, use `satisfies`:

```astro
<StoryblokRichText document={block.text} data={{ locale: "es" } satisfies ExtraProps} />
```

A `components.blok` renderer replaces the registry for embedded blocks.

### `StoryblokPreview`

Connects the page to the Visual Editor. It reloads the page when an editor saves or publishes the
story, and with `liveUpdate`, it also updates the page as the editor types.

```astro
---
import { StoryblokPreview } from "@storyblok/astro";
---

<StoryblokPreview
  liveUpdate
  debounceMs={200}
  bridgeOptions={{ resolveRelations: ["featured-articles.articles"] }}
/>
```

| Key             | Description                                                                                             | Type           |
| --------------- | ------------------------------------------------------------------------------------------------------- | -------------- |
| `liveUpdate`    | Updates the page as the editor types, in addition to reloading on save or publish. Defaults to `false`. | `boolean`      |
| `debounceMs`    | Delay in milliseconds after the last input event before the page updates. Defaults to `500`.            | `number`       |
| `bridgeOptions` | Options passed to the [Preview Bridge](https://www.storyblok.com/docs/libraries/js/preview-bridge).     | `BridgeParams` |

`liveUpdate` sends each update to the current URL as a POST request and renders the response, so the
route must render on demand. On a prerendered route, the update request fails, and
`StoryblokPreview` logs a warning in development. Reloading on save or publish works on every route.

Render one `StoryblokPreview` per page, for example in the layout. A second instance throws an error
in development. In production, it logs a warning, and only the first instance stays active.
`StoryblokPreview` works with Astro’s `<ClientRouter />`.

To disable live preview for a route, don’t render `StoryblokPreview` there:

```astro
{!disableLivePreview && <StoryblokPreview liveUpdate />}
```

### `storyblokPreviewMiddleware`

Astro middleware that stores the Visual Editor’s preview payload in `Astro.locals`, so
`getPayload()` can read it back. `<StoryblokPreview liveUpdate />` requires it.

```ts
// src/middleware.ts
import { sequence } from "astro:middleware";
import { storyblokPreviewMiddleware } from "@storyblok/astro";

export const onRequest = sequence(storyblokPreviewMiddleware);
```

The middleware captures the payload only for same-origin JSON POST requests with the Visual Editor’s
query parameters. Without it, `getPayload()` returns an empty object, and live preview updates
render the content fetched by the page instead of the edited story.

### `getPayload()`

Reads the story and server data posted by a live preview update. Requires
`storyblokPreviewMiddleware`.

```ts
function getPayload<ServerData extends object = object, TStory = LivePreviewStory>(params: {
  locals: object;
}): Promise<{ story?: TStory; serverData?: ServerData }>;
```

Outside a live preview update, both properties are `undefined`, so the same page serves preview and
published content:

```astro
---
import {
  getPayload,
  StoryblokPreview,
  StoryblokServerData,
  type StoryblokBlockData,
} from "@storyblok/astro";
import { getUsers, type User } from "../lib/get-users";
import { apiClient, StoryblokBlock } from "../storyblok";

type ServerData = { users?: User[] };
type MyStory = { content: StoryblokBlockData };

const { slug } = Astro.params;
const payload = await getPayload<ServerData, MyStory>({ locals: Astro.locals });

const story =
  payload.story ??
  (
    await apiClient.stories.get(slug || "home", {
      query: { version: "draft", resolve_relations: "featured-articles.articles" },
    })
  ).data?.story;

const users = payload.serverData?.users ?? (await getUsers());

if (!story) {
  return new Response(null, { status: 404 });
}
---

<StoryblokBlock block={story.content} />
<StoryblokServerData users={users} />
<StoryblokPreview liveUpdate bridgeOptions={{ resolveRelations: ["featured-articles.articles"] }} />
```

The story type defaults to `LivePreviewStory`, because the Visual Editor sends a partial story.

Pass the same relations to `resolve_relations` and to `bridgeOptions.resolveRelations`, so live
preview updates resolve them too.

The browser sends `serverData` back with every live preview update, so any client can modify it. Use
it only for display data, never for IDs, permissions, or other values the server relies on.

### `StoryblokServerData`

Passes server-side data to live preview updates. Use it for data that is slow or expensive to fetch,
such as an external API or a database query. `StoryblokServerData` embeds its props in the page as
JSON, and each live preview update sends them back, where `getPayload()` returns them as
`serverData`.

```astro
<StoryblokServerData users={users} />
```

### `StoryblokRichText`

Renders a Storyblok rich text field without a block registry. Embedded blocks render only through
`components.blok`. Without a `blok` renderer, `StoryblokRichText` skips them and logs a warning. To
render embedded blocks with your registered components, use the
[registry-bound `StoryblokRichText`](#registry-bound-storyblokrichtext).

```astro
---
import { StoryblokRichText } from "@storyblok/astro";
import EmbeddedBlock from "../components/EmbeddedBlock.astro";
---

<StoryblokRichText document={block.text} components={{ blok: EmbeddedBlock }} />
```

Both variants accept the following props:

| Key             | Description                                                                                         | Type                                                |
| --------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `document`      | The rich text field to render. Required.                                                            | `StoryblokRichTextInput`                            |
| `components`    | Astro components for rich text nodes and marks, keyed by node or mark name.                         | `StoryblokAstroRichTextComponentMap`                |
| `optimizeImage` | Image optimization for image nodes.                                                                 | `boolean \| Partial<StoryblokRichTextImageOptions>` |
| `data`          | Custom data passed to every custom component as `context.data`.                                     | `unknown`                                           |
| `warnings`      | Set to `false` to silence the warnings for embedded blocks that render nothing. Defaults to `true`. | `boolean`                                           |

For the supported nodes and marks, refer to the
[@storyblok/richtext reference](https://www.storyblok.com/docs/libraries/js/rich-text).

#### Custom components

Type a custom component’s props with `StoryblokAstroRichTextProps<T>`, where `T` is the node or mark
name. Marks receive their rendered content through `<slot />`:

```astro
---
// src/components/CustomLink.astro
import type { StoryblokAstroRichTextProps } from "@storyblok/astro";

type Props = StoryblokAstroRichTextProps<"link">;

const { attrs } = Astro.props;
---

<a href={attrs?.href ?? ""} target={attrs?.target ?? "_self"}>
  <slot />
</a>
```

Nodes also receive their rendered children through `<slot />`:

```astro
---
// src/components/CustomHeading.astro
import type { StoryblokAstroRichTextProps } from "@storyblok/astro";
import type { HTMLTag } from "astro/types";

type Props = StoryblokAstroRichTextProps<"heading">;

const { attrs } = Astro.props;
const Tag = `h${attrs?.level ?? 1}` as HTMLTag;
---

<Tag class="custom-heading">
  <slot />
</Tag>
```

To render a node’s children yourself, pass `content` and `context` to `StoryblokRichText`. For
example, a table component that splits header rows from body rows with `splitTableRows` from
`@storyblok/richtext`:

```astro
---
// src/components/CustomTable.astro
import { StoryblokRichText, type StoryblokAstroRichTextProps } from "@storyblok/astro";
import { splitTableRows } from "@storyblok/richtext";

type Props = StoryblokAstroRichTextProps<"table">;

const { content, context } = Astro.props;
const { headerRows, bodyRows } = splitTableRows(content);
---

<table class="custom-table">
  {
    headerRows.length > 0 && (
      <thead>
        <StoryblokRichText document={headerRows} {...context} />
      </thead>
    )
  }
  <tbody>
    <StoryblokRichText document={bodyRows} {...context} />
  </tbody>
</table>
```

Pass the components to `StoryblokRichText`:

```astro
---
import type { StoryblokAstroRichTextComponentMap } from "@storyblok/astro";
import CustomHeading from "../components/CustomHeading.astro";
import CustomLink from "../components/CustomLink.astro";
import CustomTable from "../components/CustomTable.astro";

const components: StoryblokAstroRichTextComponentMap = {
  heading: CustomHeading,
  link: CustomLink,
  table: CustomTable,
};
---

<StoryblokRichText document={block.text} components={components} />
```

### `storyblokEditable()`

Returns the attributes that make a block selectable in the Visual Editor. Components rendered
through `StoryblokBlock` already receive them as the `editable` prop. Use `storyblokEditable()` for
blocks rendered another way:

```ts
function storyblokEditable(block?: { _editable?: string }): Record<string, string>;
```

```astro
---
import { storyblokEditable } from "@storyblok/astro";

const { block } = Astro.props;
---

<section {...storyblokEditable(block)}>{block.title}</section>
```

`storyblokEditable()` returns `{}` when the block has no valid `_editable` value, for example
outside the Visual Editor.

### `editableField()`

Returns the attribute that makes a single field selectable in the Visual Editor.

```ts
function editableField(field: string): EditableFieldAttributes | Record<string, never>;
```

```astro
<h1 {...editableField("headline")}>{block.headline}</h1>
```

`editableField()` returns `{}` for an empty field name.

### `isInEditor()`

Checks whether a URL is a Visual Editor request. The URL must include the `_storyblok`,
`_storyblok_c`, and `_storyblok_tk[space_id]` query parameters.

```ts
function isInEditor(url: URL, options?: { spaceId?: string }): boolean;
```

```astro
---
import { isInEditor } from "@storyblok/astro";

const inEditor = isInEditor(Astro.url);
---
```

Pass `spaceId` to also require the request to come from that space.

### `sanitizeJSON()`

Serializes data to JSON that is safe to embed in an HTML `<script>` element. It escapes `<`, `>`,
`&`, and the U+2028 and U+2029 line separators. `StoryblokServerData` uses it for its props.

```ts
function sanitizeJSON(data: unknown): string;
```

`sanitizeJSON(undefined)` returns `"null"`.

## Live preview

`<StoryblokPreview liveUpdate />` renders the page on the server as the editor types, and morphs the
result into the current page. Each update sends the edited story to the current URL as a POST
request. `storyblokPreviewMiddleware` captures it, and `getPayload()` returns it to the page.

- If the Visual Editor has a focused element, the update morphs only that element and preserves its
  interactive state (`value`, `checked`, and others).
- Elements with the `data-preserve-state` attribute keep their content across updates, regardless of
  focus.
- Updates keep attribute changes made in the browser, such as an open `<details>` element.

```html
<div data-preserve-state></div>
```

### Events

Both events dispatch on `document`, require `<StoryblokPreview liveUpdate />`, and contain the
edited story in `event.detail.story`:

- `storyblok-live-preview-updating`: Fires before the page updates. Cancelable.
- `storyblok-live-preview-updated`: Fires after the page updates.

```html
<script>
  document.addEventListener("storyblok-live-preview-updating", (event) => {
    console.log("Storyblok live preview: DOM updating", event.detail.story);
  });

  document.addEventListener("storyblok-live-preview-updated", (event) => {
    console.log("Storyblok live preview: DOM updated", event.detail.story);
  });
</script>
```

To skip an update, call `event.preventDefault()` in a `storyblok-live-preview-updating` listener:

```js
document.addEventListener("storyblok-live-preview-updating", (event) => {
  event.preventDefault();
});
```

## Types

`@storyblok/astro` exports the following types.

| Type                                           | Description                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DefineStoryblokBlocksOptions`                 | Return value of the `defineStoryblokBlocks()` factory.                               |
| `DefineStoryblokBlocksResult`                  | Return value of `defineStoryblokBlocks()`: `StoryblokBlock` and `StoryblokRichText`. |
| `StoryblokBlockComponent`                      | An Astro component that renders a block.                                             |
| `StoryblokBlockComponentProps<T, TExtraProps>` | Props of a block component: `block`, `editable`, and the extra props.                |
| `StoryblokBlockData<T>`                        | A block’s content: the fields in `T` plus `component`, `_uid`, and `_editable`.      |
| `StoryblokBlockProps`                          | Props of `StoryblokBlock`.                                                           |
| `StoryblokComponentMap`                        | Map of technical block names to block components.                                    |
| `StoryblokEditableProps`                       | Return value of `storyblokEditable()`.                                               |
| `StoryblokExtraProps`                          | Constraint for the `TExtraProps` type argument. Excludes `block` and `editable`.     |
| `StoryblokPreviewProps`                        | Props of `StoryblokPreview`.                                                         |
| `StoryblokRichTextComponentProps`              | Props of `StoryblokRichText`.                                                        |
| `StoryblokAstroRichTextComponentMap`           | Map of rich text node and mark names to custom components.                           |
| `StoryblokAstroRichTextProps<T>`               | Props of a custom rich text component for the node or mark `T`.                      |
| `StoryblokAstroRichTextRenderContext`          | The `context` prop of a custom rich text component.                                  |
| `BridgeParams`                                 | Preview Bridge options, re-exported from `@storyblok/live-preview`.                  |

## Further resources

- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn
  how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
- [@storyblok/richtext Package Reference](https://www.storyblok.com/docs/libraries/js/rich-text)—Find
  the supported rich text nodes and marks in the @storyblok/richtext reference.
- [@storyblok/live-preview Package Reference](https://github.com/storyblok/monoblok/blob/main/packages/live-preview/docs/reference.md)—Learn
  how the live preview update works in the @storyblok/live-preview reference.
- [Repository playground](https://github.com/storyblok/monoblok/tree/main/packages/astro/playground)—Explore
  more examples in the Astro playground.
