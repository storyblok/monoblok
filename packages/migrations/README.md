<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1>@storyblok/migrations</h1>
  <p>
    Pure utility helpers to migrate content into <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-migrations" target="_blank">Storyblok</a>.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/migrations">
    <img src="https://img.shields.io/npm/v/@storyblok/migrations/latest.svg?style=flat-square&color=8d60ff" alt="@storyblok/migrations" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/migrations" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/migrations.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-migrations">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- **Content Converters** - Convert HTML and Markdown to Storyblok rich text format
- **Link & Asset Helpers** - Transform URLs into Storyblok link and asset objects
- **Paginated Fetching** - Fetch all stories and assets across paginated API responses
- **Local File Workflows** - Read and update locally pulled stories, assets, components, and datasources
- **Reference Mapping** - Remap story and asset references when migrating between spaces
- **Schema Cleanup** - Remove out-of-schema fields and rename datasource values

## Installation

```bash
npm install @storyblok/migrations
# or
pnpm add @storyblok/migrations
```

## Quick Start

```ts
import { htmlToStoryblokRichtext, markdownToStoryblokRichtext, urlToAsset, urlToLink } from '@storyblok/migrations';

const cta = urlToLink('https://example.com/pricing#plans', {
  target: '_blank',
  title: 'See plans',
});

const heroImage = urlToAsset('https://cdn.example.com/hero.jpg', {
  alt: 'Hero image',
});

const docFromHtml = htmlToStoryblokRichtext('<p>Hello</p>');
const docFromMarkdown = markdownToStoryblokRichtext('# Hello');
```

## API Overview

- `urlToLink(url, options?)`
- `urlToAsset(url, options?)`
- `getAllStories(fn)`
- `getAllAssets(fn)`
- `getLocalStories(dir)` / `updateLocalStory(dir, story)`
- `getLocalAssets(dir)` / `updateLocalAsset(dir, asset)`
- `getLocalComponents(dir)` / `updateLocalComponent(dir, component)`
- `getLocalDatasources(dir)` / `updateLocalDatasource(dir, datasource)`
- `mapRefs(story, { schemas, maps })`
- `renameDataSourceValue(story, componentsToUpdate, oldValue, newValue)`
- `deleteOutOfSchemaFields(story, schemas)`

## Examples

### Converting HTML and Markdown

```ts
import { htmlToStoryblokRichtext, markdownToStoryblokRichtext } from '@storyblok/migrations';

const docFromHtml = htmlToStoryblokRichtext('<p>Hello <strong>world</strong></p>');
const docFromMarkdown = markdownToStoryblokRichtext('# Hello\n\nA paragraph with **bold** text.');
```

### Creating links and assets

```ts
import { urlToAsset, urlToLink } from '@storyblok/migrations';

const cta = urlToLink('https://example.com/pricing#plans', {
  target: '_blank',
  title: 'See plans',
});

const email = urlToLink('mailto:hello@example.com');

const heroImage = urlToAsset('https://cdn.example.com/hero.jpg', {
  alt: 'Hero image',
  copyright: '2025 Example Inc.',
});
```

### Fetching all stories and assets

```ts
import { getAllAssets, getAllStories } from '@storyblok/migrations';

const stories = await getAllStories(page =>
  client.stories.list({
    path: { space_id: 12345 },
    query: { page, per_page: 100 },
  }),
);

const assets = await getAllAssets(page =>
  client.assets.list({
    path: { space_id: 12345 },
    query: { page, per_page: 100 },
  }),
);
```

### Local stories

Pull stories locally with the Storyblok CLI, modify them with the migration helpers, then push them back:

> **Note:** For many migration scenarios, [Storyblok CLI migrations](https://www.storyblok.com/docs/cli/migrations) are the preferable approach. Use the local stories workflow when you need fine-grained, programmatic control that goes beyond what CLI migrations offer.

```bash
storyblok stories pull --space 12345
```

```ts
import { getLocalStories, updateLocalStory } from '@storyblok/migrations';

const dir = '.storyblok/stories/12345';
const stories = await getLocalStories(dir);

const first = stories[0];
first.name = `${first.name} (migrated)`;

await updateLocalStory(dir, first);
```

```bash
storyblok stories push --space 12345
```

### Local assets

```bash
storyblok assets pull --space 12345
```

```ts
import { getLocalAssets, updateLocalAsset } from '@storyblok/migrations';

const dir = '.storyblok/assets/12345';
const assets = await getLocalAssets(dir);

const first = assets[0];
first.alt = 'Updated alt text';

await updateLocalAsset(dir, first);
```

### Local components

```bash
storyblok components pull --space 12345 --separate-files
```

```ts
import { getLocalComponents, updateLocalComponent } from '@storyblok/migrations';

const dir = '.storyblok/components/12345';
const components = await getLocalComponents(dir);

const hero = components.find(c => c.name === 'hero');
hero.schema.subtitle = { type: 'text' };

await updateLocalComponent(dir, hero);
```

### Local datasources

```bash
storyblok datasources pull --space 12345
```

```ts
import { getLocalDatasources, updateLocalDatasource } from '@storyblok/migrations';

const dir = '.storyblok/datasources/12345';
const datasources = await getLocalDatasources(dir);

const first = datasources[0];
first.name = 'Renamed datasource';

await updateLocalDatasource(dir, first);
```

### Reference mapping

Pull component schemas locally with the Storyblok CLI, then use them to remap references when migrating stories between spaces:

```bash
storyblok components pull --space 12345 --separate-files
```

```ts
import { type ComponentSchemas, getLocalComponents, mapRefs } from '@storyblok/migrations';

const components = await getLocalComponents('.storyblok/components/12345');

const schemas: ComponentSchemas = {};
for (const component of components) {
  schemas[component.name] = component.schema;
}

const { mappedStory, missingSchemas } = mapRefs(story, {
  schemas,
  maps: {
    stories: new Map([[oldStoryId, newStoryId]]),
    assets: new Map([[oldAssetId, newAssetId]]),
  },
});
```

### Renaming datasource values

```ts
import { renameDataSourceValue } from '@storyblok/migrations';

const { story: updatedStory, changes } = renameDataSourceValue(
  story,
  [{ name: 'product_card', field: 'category' }],
  'old-category',
  'new-category',
);
```

### Deleting out-of-schema fields

Use component schemas to strip fields that no longer belong to a component:

```ts
import { type ComponentSchemas, deleteOutOfSchemaFields, getLocalComponents } from '@storyblok/migrations';

const components = await getLocalComponents('.storyblok/components/12345');

const schemas: ComponentSchemas = {};
for (const component of components) {
  schemas[component.name] = component.schema;
}

const { story: cleanedStory, removedFields } = deleteOutOfSchemaFields(story, schemas);
```

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

- [Discuss Storyblok on Github Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

## Contributing

If you're interested in contributing, please read our [contributing docs](https://github.com/storyblok/.github/blob/main/contributing.md) before submitting a pull request.

## License

[License](/LICENSE)
