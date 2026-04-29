# Code-Driven Storyblok with Qwik

This playground demonstrates a fully code-driven Storyblok workflow. TypeScript schema definitions are the single source of truth, the CLI syncs them to the remote space, and the Qwik frontend consumes content with end-to-end type safety.

## Typical workflow

1. **Define your schema** in TypeScript under `src/schema/`. Create reusable fields in `fields.ts`, compose them into components in `components/`, and export datasource definitions from `schema.ts`.
2. **Push the schema** to your Storyblok space:
   ```sh
   pnpm schema:push
   ```
3. **Handle migrations** if the CLI detects breaking changes (field renames, removals, type changes). The CLI prompts interactively or use `--migrations` / `--no-migrations` flags for CI.
4. **Seed content** into the space (see [Content seeding](#content-seeding) below).
5. **Start the dev server** and build your frontend against fully typed content:
   ```sh
   pnpm dev
   ```

## Project structure

```
src/
├── schema/                 # Component and field definitions (source of truth)
│   ├── schema.ts           # Master schema export + type inference
│   ├── fields.ts           # Reusable field definitions
│   └── components/         # One file per component (hero.ts, page.ts, …)
├── components/storyblok/   # Qwik components with typed props
├── lib/                    # API client setup with schema-driven type narrowing
└── routes/                 # Qwik City pages that fetch typed content
.storyblok/                 # Changesets and push reports (managed by CLI)
```

## Prerequisites

- Node.js and pnpm
- A Storyblok space with a management API token and a preview token
- A `.env` file in this directory:

```env
STORYBLOK_TOKEN=<management-api-personal-access-token>
STORYBLOK_PREVIEW_TOKEN=<preview-token>
STORYBLOK_SPACE_ID=<space-id>
```

## Key CLI commands

| Command | Description |
| --- | --- |
| `pnpm schema:push` | Push local schema and datasource definitions to the space and delete stale schema entities |
| `pnpm schema:pull` | Bootstrap `src/schema/` from an existing remote space |
| `pnpm schema:rollback` | Roll back to the previous schema state from changesets |
| `pnpm seed` | Push schema, datasource entries, assets, and stories |
| `pnpm seed:cleanup` | Delete all stories, assets, and datasources from the space |
| `pnpm dev` | Start the Qwik dev server |

## Schema definition at a glance

Define reusable fields:

```ts
// src/schema/fields.ts
import { defineField } from '@storyblok/schema';

export const headlineField = defineField({
  type: 'text',
  max_length: 120,
});
```

Compose them into components:

```ts
// src/schema/components/hero.ts
import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { headlineField } from '../fields';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0, required: true }),
    image: defineProp(defineField({ type: 'asset', filetypes: ['images'] }), { pos: 1 }),
  },
});
```

For the full helper API (`defineBlock`, `defineField`, `defineProp`, type inference, Zod schemas), see the [`@storyblok/schema` documentation](https://www.storyblok.com/docs/packages/storyblok-schema) (WIP).

## Content seeding

Seed the space with demo content after pushing the schema:

```sh
pnpm seed
```

This pushes the schema first, then datasource entries, assets, and stories via CLI commands. Datasource definitions live in `src/schema/` and are owned by `schema:push`; datasource entries live in `.storyblok/datasources/` and are owned by `datasources push`. The seed data lives under `.storyblok/` and is checked into git.

`pnpm schema:pull` is intended as a bootstrap step when adopting an existing Storyblok space. After that, keep `src/schema/` as the source of truth and use `pnpm schema:push` for ongoing changes rather than pulling repeatedly.

To re-seed an existing space, clean up first:

```sh
pnpm seed:cleanup && pnpm seed
```

## The code-driven philosophy

- **Schema lives in the repo, not the UI.** Define components, fields, and their constraints in TypeScript files under version control.
- **TypeScript definitions are authoritative.** The CLI reads your local schema and enforces that state on the remote Storyblok space.
- **Diff before you push.** The CLI compares local definitions against the remote space and shows what will change before applying anything.
- **Schema owns schema entities.** The `--delete` flag removes remote components and datasource definitions that no longer exist in the local schema export.
- **Datasource entries are content, not schema.** Keep datasource entries in `.storyblok/datasources/` and push them with `storyblok datasources push`.
- **Breaking changes surface migration prompts.** When field renames, removals, or type changes are detected during push, the CLI offers to generate ready-to-run migration files.
- **Changeset history enables rollback.** Every push records the pre-push remote state in `.storyblok/schema/changesets/`, so you can roll back to a previous state.

## Further reading

- [`@storyblok/schema` documentation](https://www.storyblok.com/docs/packages/storyblok-schema) (WIP) — full helper API reference
- [ADR-0003](../../../../adr/0003-schema-command-for-code-driven-workflows.md) — rationale for the dedicated `schema` command
- [ADR-0004](../../../../adr/0004-schema-push-migration-generation.md) — migration generation integrated into schema push
