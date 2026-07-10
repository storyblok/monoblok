<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/schema</h1>
 <p>
    Shared Storyblok schema types generated from the Management and Content API specifications
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/schema">
    <img src="https://img.shields.io/npm/v/@storyblok/schema/latest.svg?style=flat-square&color=8d60ff" alt="@storyblok/schema" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/schema" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/schema.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=@storyblok/schema">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- **Generated Types**: TypeScript types generated from Storyblok Management and Content API OpenAPI specifications
- **Shared Schema Layer**: Reuse the same Storyblok content shapes across packages and integrations
- **Framework Agnostic**: Use the package in any TypeScript project without framework-specific dependencies
- **Monorepo Aligned**: Built from the same source specifications used throughout the Storyblok monoblok repository

## Documentation

<!-- TODO: restore docs link once live — https://www.storyblok.com/docs/packages/storyblok-schema (docs #536/#548) -->

Full package documentation is coming soon. For now, browse the [package source on GitHub](https://github.com/storyblok/monoblok/tree/alpha/packages/schema) or explore a runnable example in the [Astro playground](https://github.com/storyblok/monoblok/tree/alpha/packages/schema/playground/astro).

### `defineFolder`

Define a block folder (component group) that organizes blocks in the Storyblok UI. Folders are identified by their **name path** (e.g. `Layout/Heros`), matched against remote groups at push time. No UUIDs in code.

```typescript
import { defineBlock, defineFolder } from '@storyblok/schema';

// Define folders
const layout = defineFolder({ name: 'Layout' });
const heros = defineFolder({ name: 'Heros', parent: layout });

// Assign blocks to folders
const heroBlock = defineBlock({
  name: 'hero',
  folder: heros, // or use the string path: 'Layout/Heros'
  fields: [
    defineField('title', { type: 'text' }),
  ],
});
```

**Key behaviors:**

- **Ref or string** — assign a block to a folder using a `defineFolder` ref or a raw path string (`'Layout/Heros'`).
- **Explicit ungrouping** — set `folder: null` to explicitly remove a block from any folder (`schema push` clears its group).
- **Absent = unmanaged** — omit the `folder` key to leave the block's remote group untouched (today's behavior; useful for incremental adoption).
- **Folder in `allow`** — restrict a `bloks` or `richtext` field to blocks in a specific folder using a folder ref:

  ```typescript
  const pageBlock = defineBlock({
    name: 'page',
    fields: [
      defineField('content', {
        type: 'bloks',
        allow: [heros], // all blocks in the Heros folder (nested subfolders included)
      }),
    ],
  });
  ```

  Or restrict to specific block names:

  ```typescript
  defineField('content', {
    type: 'bloks',
    allow: ['teaser', 'hero'], // restrict to these block names only
  });
  ```

- **No mixing restriction modes** — cannot mix block refs and folder refs in one field's `allow`. The editor enforces exclusive restriction modes (blocks **or** folders, not both). Throws at define time if you try.
- **Richtext support** — folder restrictions work identically on both `bloks` and `richtext` fields.
- **No `/` in names** — folder names cannot contain `/` (would corrupt the path semantics). Throws at define time.

**Registration (optional):**

Register folders explicitly in your schema to ensure they are created even if nothing references them:

```typescript
import { defineSchema } from '@storyblok/schema';

const schema = defineSchema({
  folders: {
    layout,
    heros,
  },
  components: {
    hero: heroBlock,
    // ...
  },
});
```

**Folder matching at push time:**

The CLI resolves folder paths to remote component groups using **case-insensitive, slugified matching** per segment. `Layout/Heros` matches remote groups at path `layout/heros` or `LAYOUT/HEROS`. This enables incremental adoption — you can add the schema DSL to existing spaces without renaming all groups.

**Limitations:**

- **Names are unique per space** — Storyblok component group names must be unique across the whole space, not just under a parent. Two folders that resolve to the same slugified leaf name (even under different parents) are rejected at push time. Re-parenting a folder while keeping its leaf name is a two-step push: rename or delete the old folder first, then push the re-parented one.
- **Consistent display paths** — when a folder is referenced by both a `defineFolder` ref and a string shorthand, write the display path consistently across all references (the schema-package validators compare display paths as written; the CLI matches them case-insensitively in slug space).
- **No rename support in v1** — a folder rename is accomplished by creating a new folder and marking the old one stale (same as component renames). Remote display names are set only at creation and are never updated by the CLI.
- **No state files** — folder identity lives entirely in code.

## Contributing

If you'd like to contribute, please refer to the [contributing guidelines](../../CONTRIBUTING.md).

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

- [Discuss Storyblok on GitHub Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a minimal reproducible example that demonstrates the issue by using tools like [Stackblitz](https://stackblitz.com) or a link to a GitHub repo. Please make sure you include a README file with the instructions to build and run the project, important not to include any access token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the [Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## License

[License](/LICENSE)
