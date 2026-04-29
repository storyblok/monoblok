---
name: storyblok-astro
description: Build Astro frontend components and pages for an existing Storyblok schema. Triggers on phrases like "build astro frontend", "create astro components for schema", "storyblok astro page".
---

# Storyblok schema → Astro frontend

This skill builds Astro components, pages, data fetching, and live preview wiring for an existing Storyblok schema.

## Prerequisites

An existing Astro 6+ project with:

- Schema defined in `src/schema/` using `@storyblok/schema` helpers, with a `src/schema/schema.ts` entry point
- `storyblok.config.ts` configured at project root
- `.env` containing `STORYBLOK_TOKEN` (MAPI), `STORYBLOK_PREVIEW_TOKEN` (CAPI draft), `STORYBLOK_PUBLIC_TOKEN` (CAPI published), and `STORYBLOK_SPACE_ID`

The agent installs any missing npm dependencies and pushes the schema.

## Checklist

### 1. Discover setup

Read `package.json`, `astro.config.mjs`, and `src/schema/schema.ts`. Identify all components (root and nestable). Record which dependencies are already installed. Note whether `tailwindcss` is present in `package.json`.

### 2. Install missing dependencies

Install any of the following that are absent from `package.json`:

- `@storyblok/astro`
- `@storyblok/api-client`
- `@storyblok/schema`
- `storyblok` (as a dev dependency — this is the CLI)

Styling rule: if `tailwindcss` is detected, use Tailwind utility classes throughout. If not, use whatever CSS approach the project already has (scoped `<style>` blocks, global CSS, CSS modules, etc.). **Never install Tailwind.**

### 3. Configure `@storyblok/astro` integration

If `astro.config.mjs` does not already have the `storyblok()` integration, add it:

```js
import { storyblok } from '@storyblok/astro';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), 'STORYBLOK');

export default defineConfig({
  integrations: [
    storyblok({
      accessToken: env.STORYBLOK_PREVIEW_TOKEN,
    }),
  ],
});
```

This enables component auto-discovery from `src/storyblok/`. Use `STORYBLOK_PREVIEW_TOKEN` (CAPI) here — `STORYBLOK_TOKEN` is the MAPI token and must not be exposed to the browser.

### 4. Push schema

```
storyblok schema push src/schema/schema.ts
```

### 5. Create API client factory

Copy `<skill-root>/blueprint/src/lib/storyblok.ts` to `src/lib/storyblok.ts`.

Adapt the `Schema` import path to match the project's actual schema location (default: `../schema/schema`).

### 6. Create layout and global styles

Copy `<skill-root>/blueprint/src/layouts/Layout.astro` to `src/layouts/Layout.astro` and `<skill-root>/blueprint/src/styles/global.css` to `src/styles/global.css`.

Adapt the layout: import `global.css`, wire SEO props (`title`, `description`) from root component fields, add `<header>`/`<footer>` if the schema has navigation or footer components. Adapt the CSS: adjust colors, fonts, and spacing to create a polished, cohesive look. If Tailwind is present, replace the global CSS with a Tailwind `@import` and move relevant styles to utility classes.

### 7. Plan base UI components

Before writing any code, analyze the schema and decide which reusable **base UI components** are needed. Base components live in `src/components/`, are independent of Storyblok, and handle all layout and styling. They accept plain props (strings, slots, booleans), not Storyblok bloks.

Look at the schema and map each component to one of the **blueprint base components** listed in the Blueprints section below. Not every schema component needs its own base component — multiple schema components can share the same base.

| Schema pattern | Blueprint base component |
|---|---|
| Hero / banner with heading + CTA | `Hero.astro` |
| Feature grid, icon cards, team grid | `FeatureGrid.astro` + `Card.astro` |
| Card-like items (features, testimonials, team) | `Card.astro` |
| Text + image side by side | `Section.astro` |
| CTA / call-to-action with image | `Cta.astro` |
| FAQ / accordion | `FaqAccordion.astro` |
| Site header / navigation | `Header.astro` |
| Site footer | `Footer.astro` |
| Buttons / links | `Button.astro` |

Write down the list of base components you will copy and which schema components will use each one.

### 8. Create base UI components

Copy the matching blueprint base components from `<skill-root>/blueprint/src/components/` to `src/components/`. Then adapt each one:

- Adjust colors to match the project's palette (the blueprints use `indigo-600` for primary, `gray-*` for neutrals, `teal-600` for accents — replace these with the project's brand colors)
- Add or remove prop variants to fit the schema's needs
- Keep them Storyblok-agnostic: no `storyblokEditable`, no `blok` props, no Storyblok imports

If the schema has a component type that doesn't map to any blueprint, create a new base component following the same conventions (props + slots, all styling here, no Storyblok imports). Use the existing blueprints as a style reference for consistent design.

### 9. Create Storyblok components

For every component in the schema (both `is_root: true` and `is_nestable: true`), create a `.astro` file in `src/storyblok/`. These components are **thin wiring layers**:

- Import base components from `src/components/`
- Map Storyblok field data to base component props using the **Field types** rules below
- Add `{...storyblokEditable(blok)}` on the outermost element
- Contain minimal or no styling — layout comes from the base components

Example:

```astro
---
import { storyblokEditable } from '@storyblok/astro';
import Card from '../components/Card.astro';

const { blok } = Astro.props;
---

<div {...storyblokEditable(blok)}>
  <Card title={blok.title} image={blok.image?.filename}>
    <Fragment set:html={await richTextToHTML(blok.body)} />
  </Card>
</div>
```

Purely structural wrappers (e.g. a `Group` that just iterates `bloks` fields) may not need a base component — they can render `<StoryblokComponent>` directly.

### 10. Investigate Storyblok content

Before creating page routes, fetch the story tree from the Storyblok space to understand how content is organized:

```ts
const { data } = await client.get('cdn/stories', { per_page: 100 });
```

Look at the folder structure. Storyblok uses **root-level folders** as organizational buckets — these typically map to site-wide elements:

- A folder like `config/`, `global/`, or `settings/` often contains stories for the **main navigation** and **footer**. These are not page routes — they are fetched once in the layout and rendered as `<Header>` / `<Footer>`.
- The root story (`/` or `home`) is usually the homepage.
- Other root folders (`blog/`, `about/`, etc.) contain page stories.

Use this information when wiring the layout: if the space has a `config/header` or `config/footer` story, fetch it in `Layout.astro` and render the corresponding Storyblok component. If the space has no such stories, fall back to static header/footer content or skip them.

### 11. Create page routes

Copy `<skill-root>/blueprint/src/pages/[...slug].astro` to `src/pages/[...slug].astro`.

Adapt:

- Wrap content in `<Layout>` and pass SEO props from root component fields
- Apply the project's styling approach

### 12. Configure live preview

Follow the **Live preview** section below. Skip entirely if the user explicitly requests static-only output.

### 13. Verify

Start the dev server (`pnpm dev` or `npm run dev`) and confirm the page renders content from Storyblok.

## Blueprints

### API client factory

Source: `<skill-root>/blueprint/src/lib/storyblok.ts`
Destination: `src/lib/storyblok.ts`

Agent adapts: the `Schema` import path to match the project's schema location. If the schema file does not export a `Schema` type, add one:

```ts
import type { Schema as InferSchema } from '@storyblok/schema';
export type Schema = InferSchema<typeof schema>;
```

### Layout

Source: `<skill-root>/blueprint/src/layouts/Layout.astro`
Destination: `src/layouts/Layout.astro`

Agent adapts: add the global CSS import (`import '../styles/global.css'`), wire SEO props (`title`, `description`) from root component fields, add a shared `<header>`/`<footer>` if the schema has navigation or footer components, add font imports if using custom fonts.

### Global CSS

Source: `<skill-root>/blueprint/src/styles/global.css`
Destination: `src/styles/global.css`

A minimal, unopinionated baseline: reset, system font stack, fluid type scale, `.container` utility, and `.richtext` prose styles. Agent adapts: swap in a custom font, adjust colors and spacing to match the project's identity, add a Tailwind `@import` instead if Tailwind is present. Import this file in `Layout.astro`.

### Catch-all page route

Source: `<skill-root>/blueprint/src/pages/[...slug].astro`
Destination: `src/pages/[...slug].astro`

Agent adapts: wrap content in `<Layout>`, pass SEO fields from root component to layout props, apply the project's styling approach.

### Base UI components

Source directory: `<skill-root>/blueprint/src/components/`
Destination directory: `src/components/`

Copy only the components that match the schema's needs. All blueprints use Tailwind utility classes — restyle if the project doesn't use Tailwind.

| Blueprint | Purpose | Key props |
|---|---|---|
| `Hero.astro` | Full-width hero banner with heading, subtitle, and CTA slot | `title`, `subtitle`, `align` |
| `Card.astro` | Generic card with icon slot, title, description | `title`, `description`, `href` |
| `FeatureGrid.astro` | Grid container for cards with optional header | `title`, `description`, `columns` |
| `Section.astro` | Text + image side by side, reversible | `title`, `description`, `image`, `reverse` |
| `Cta.astro` | Call-to-action split layout with image | `title`, `description`, `image` |
| `Header.astro` | Site header with navigation links and action slots | `links[]` |
| `Footer.astro` | Site footer with grouped link columns | `groups[]`, `copyright` |
| `FaqAccordion.astro` | Accordion FAQ list using `<details>` | `items[]` |
| `Button.astro` | Styled link button with primary/secondary variants | `href`, `variant` |

Agent adapts: adjust brand colors (blueprints use `indigo-600` primary, `teal-600` accent, `gray-*` neutrals), add or remove props to fit the schema, split or combine components as needed.

## Field types

| Field type | Rendering pattern |
|---|---|
| `text` | `{blok.fieldName}` — render as text content or attribute |
| `textarea` | `{blok.fieldName}` — render in a `<p>` or similar block element |
| `richtext` | `await richTextToHTML(blok.fieldName)` from `@storyblok/astro/client` — render with `set:html` |
| `markdown` | Render raw markdown string as HTML (e.g. `<Fragment set:html={blok.fieldName} />` or use a markdown parser) |
| `number` | `{blok.fieldName}` — render as text, use for computed styles/attributes |
| `boolean` | Conditional rendering — `{blok.fieldName && <element>}` |
| `datetime` | Format with `Date` and render as text |
| `asset` | See **Image optimization** below |
| `multiasset` | Map over array, render each as an optimized `<img>` (see **Image optimization**) |
| `multilink` | See **Multilink handling** below |
| `bloks` | Map and render each with `<StoryblokComponent blok={nestedBlok} />` |
| `option` | `{blok.fieldName}` — render value as text or use as CSS class/variant |
| `options` | Map over selected values |
| `table` | Render as `<table>` with `thead`/`tbody` from `blok.fieldName.thead`/`blok.fieldName.tbody` |

### Image optimization

Storyblok serves images through a CDN that supports on-the-fly transforms via the `/m/` path segment. Append `/m/{width}x{height}/filters:{filters}/` to the `filename` URL:

```
original:  https://a.storyblok.com/f/12345/1920x1080/abc123/photo.jpg
resized:   https://a.storyblok.com/f/12345/1920x1080/abc123/photo.jpg/m/800x0/
optimized: https://a.storyblok.com/f/12345/1920x1080/abc123/photo.jpg/m/800x0/filters:format(webp):quality(80)
```

Use this pattern in components instead of raw `filename` URLs:

```astro
---
const { blok } = Astro.props;

function storyblokImage(filename: string, width: number, height = 0) {
  return `${filename}/m/${width}x${height}/filters:format(webp):quality(80)`;
}
---

{blok.image?.filename && (
  <img
    src={storyblokImage(blok.image.filename, 800)}
    srcset={`${storyblokImage(blok.image.filename, 400)} 400w, ${storyblokImage(blok.image.filename, 800)} 800w, ${storyblokImage(blok.image.filename, 1200)} 1200w`}
    sizes="(min-width: 48rem) 50vw, 100vw"
    alt={blok.image.alt || ''}
    loading="lazy"
    decoding="async"
  />
)}
```

Key rules:
- Always use `loading="lazy"` and `decoding="async"` for off-screen images. Use `loading="eager"` only for above-the-fold hero images.
- Generate `srcset` with 2–3 widths (e.g. 400, 800, 1200) and matching `sizes`.
- Use `format(webp)` and `quality(80)` filters for optimal file size.
- Use `width x 0` to resize by width only (preserves aspect ratio).

### Multilink handling

A `multilink` field has a `linktype` property that determines how to resolve the URL. Handle all four types:

| `linktype` | `href` | Notes |
|---|---|---|
| `story` | `'/' + link.cached_url` | Prefix with `/` for internal routing |
| `url` | `link.url` | External URL, use as-is |
| `email` | `'mailto:' + link.url` | Wrap in `mailto:` |
| `asset` | `link.url` | Direct link to an asset file |

Additional properties:
- `link.anchor` — append as `#${link.anchor}` when present
- `link.target` — set as the `target` attribute (typically `_blank` for external links)

```astro
---
function resolveLink(link: any) {
  if (!link) return { href: '#', target: undefined };

  let href: string;
  switch (link.linktype) {
    case 'story':
      href = '/' + (link.cached_url || '');
      break;
    case 'email':
      href = 'mailto:' + (link.url || '');
      break;
    default:
      href = link.url || '#';
  }

  if (link.anchor) href += '#' + link.anchor;

  return { href, target: link.target || undefined };
}

const { href, target } = resolveLink(blok.link);
---

<a href={href} target={target}>{blok.label}</a>
```

## Component conventions

### Two-layer architecture

| Layer | Directory | Responsibility | Knows about Storyblok? |
|---|---|---|---|
| **Base components** | `src/components/` | Layout, styling, visual design | No — plain props + `<slot>` |
| **Storyblok components** | `src/storyblok/` | Data wiring, editable markers | Yes — `blok`, `storyblokEditable` |

Storyblok components are thin wrappers that map `blok` fields to base component props. All visual styling lives in base components.

### Storyblok component rules

- Files go in `src/storyblok/`, named in PascalCase matching the camelCased schema component name (e.g. `media_text` → `MediaText.astro`).
- Always spread `storyblokEditable(blok)` on the outermost element.
- Import `StoryblokComponent` only when the component has `bloks` fields.
- Import `richTextToHTML` only when the component has `richtext` fields.
- Import base components from `../components/` and pass data as props — do not duplicate styling here.

### Base component rules

- Files go in `src/components/`, named in PascalCase by their visual role (e.g. `Hero.astro`, `Card.astro`, `Grid.astro`).
- Accept data via **props** and **`<slot>`** — never import Storyblok types.
- Own all visual styling (Tailwind classes, scoped styles, etc.).

### General rules

- **No JSX in frontmatter.** Astro frontmatter (`---` block) is plain TypeScript — you cannot assign JSX/HTML elements to variables. All HTML must go in the template section below the frontmatter. Use inline conditionals (`{condition ? <a> : <b>}`) or `{condition && <el>}` in the template instead.

### Storyblok component template

```astro
---
import { storyblokEditable } from '@storyblok/astro';
import StoryblokComponent from '@storyblok/astro/StoryblokComponent.astro';
import Hero from '../components/Hero.astro';

const { blok } = Astro.props;
---

<div {...storyblokEditable(blok)}>
  <Hero title={blok.title} subtitle={blok.subtitle}>
    {blok.buttons?.map((nestedBlok) => (
      <StoryblokComponent blok={nestedBlok} />
    ))}
  </Hero>
</div>
```

## Live preview

Skip this section if the user explicitly says they only want static output or don't need the visual editor.

### 1. Enable local HTTPS

The Storyblok visual editor loads the preview in an HTTPS iframe. The dev server must serve over HTTPS. Install `@vitejs/plugin-basic-ssl` and add it to the Vite config:

```js
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  vite: {
    plugins: [basicSsl()],
  },
});
```

The dev server will then be available at `https://localhost:4321/`.

### 2. Install an SSR adapter

Detect the deployment target from existing config or ask the user. Default to `@astrojs/node` if unclear.

### 3. Enable SSR in `astro.config.mjs`

```js
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

### 4. Enable `livePreview` in the Storyblok integration config

```js
storyblok({
  accessToken: env.STORYBLOK_PREVIEW_TOKEN,
  livePreview: true,
}),
```

### 5. Tell the user

Instruct the user to configure the visual editor preview URL in their Storyblok space settings to point to their dev server (e.g. `https://localhost:4321/`).

## Styling

Make the Astro site look polished and modern — design a cohesive visual identity with good typography, spacing, color palette, and visual hierarchy. Every component should feel intentionally designed, not like unstyled HTML.

- If not using Tailwind, use whatever CSS approach the project already has (scoped `<style>` blocks, global CSS, CSS modules, etc.).
- Never install Tailwind if it is not already present.
- The blueprint base components use Tailwind utility classes. If the project does not use Tailwind, restyle the copied components with scoped `<style>` blocks or the project's CSS approach.
- Define a consistent design system: pick a type scale, set a spacing rhythm, choose a small color palette, and apply them uniformly across all components.
- Use a sensible `max-width` on content containers, generous whitespace, and responsive breakpoints.
- Style interactive elements (links, buttons) with clear hover/focus states.

## Storyblok CLI

The `storyblok` CLI (installed as a dev dependency) manages the connection between local schema definitions and the remote Storyblok space. All commands read the space ID from `storyblok.config.ts`. Run all CLI commands from the project root (where `storyblok.config.ts` lives).

### Schema commands

| Command | When to use |
|---|---|
| `storyblok schema push src/schema/schema.ts` | After changing any component or datasource definition in `src/schema/`. Diffs local vs remote and applies creates/updates. Use `--delete` to remove remote components not in the local schema. Use `--dry-run` to preview changes without applying. |
| `storyblok schema pull` | Bootstrap a local schema from an existing Storyblok space. Writes TypeScript files to `.storyblok/schema/` as a starting point — copy what you need into `src/schema/` and refine. |
| `storyblok schema rollback` | Revert the last `schema push`. Uses changesets saved in `.storyblok/schema/changesets/`. |

### Schema push and migration generation

`schema push` generates migration scaffolds by default when it detects breaking changes (disable with `--no-migrations`). Breaking changes are:

- **Field removed** — a field exists remotely but not locally
- **Field renamed** — a removed + added field pair with matching type and similar name (detected automatically)
- **Field type changed** — e.g. `text` → `number`
- **Required field added** — new field with `required: true`
- **Required flag changed** — existing field changed from optional to required

When breaking changes are detected, `schema push`:

1. Analyzes the diff and detects renames (matching field types + name similarity)
2. Prompts for confirmation of detected renames
3. Generates JavaScript migration files in `migrations/{spaceId}/{componentName}.{timestamp}.js`
4. Applies the schema changes to the space
5. Tells you to run `storyblok migrations run` to transform existing story content

Generated migration files export a function that receives a block and returns the transformed block:

```js
export default function (block) {
  // Rename: old_title → title
  if ('old_title' in block) {
    block.title = block.old_title;
    delete block.old_title;
  }

  // Type change: count (text → number)
  block.count = Number(block.count) || 0;

  // New required field: subtitle (text)
  block.subtitle = block.subtitle ?? '';

  return block;
}
```

Review and edit these scaffolds before running them — they are starting points, not final migrations.

### Migrations commands

| Command | When to use |
|---|---|
| `storyblok migrations run [componentName]` | Run pending migration files against stories in the space. Applies migration functions to all matching blocks recursively, saves rollback data, and updates stories. Use `--dry-run` to preview. Use `--publish all` to publish updated stories. |
| `storyblok migrations generate <componentName>` | Manually create an empty migration scaffold for a component (outside of `schema push`). Use `--suffix <name>` to add a label to the filename. |
| `storyblok migrations rollback [migrationFile]` | Revert a specific migration run using saved rollback data. |

### Typical schema evolution workflow

1. Edit component definitions in `src/schema/`
2. Run `storyblok schema push src/schema/schema.ts`
3. If breaking changes detected: review generated migration files in `migrations/`
4. Run `storyblok migrations run --publish all` to transform existing content
5. Update Astro components in `src/storyblok/` to match the new schema

### Other useful commands

| Command | Purpose |
|---|---|
| `storyblok stories push --from <source>` | Push story JSON files from `.storyblok/stories/<source>/` to the space |
| `storyblok datasources push --from <source>` | Push datasource entries from `.storyblok/datasources/<source>/` |
| `storyblok assets push --from <source>` | Push assets from `.storyblok/assets/<source>/` |

## Key technical details

- **Data fetching:** Use `@storyblok/api-client` with `.withTypes<Schema>()` for type-safe story fetching. Do **not** use `useStoryblokApi()` from `@storyblok/astro` for data fetching. Use `STORYBLOK_PREVIEW_TOKEN` in dev (draft content) and `STORYBLOK_PUBLIC_TOKEN` in production (published content).
- **Component resolution:** `@storyblok/astro` auto-discovers components in `src/storyblok/` by filename — no manual registration needed.
- **Rich text:** Use `await richTextToHTML()` from `@storyblok/astro/client` for `richtext` fields. For `markdown` fields, render the raw string directly or use a markdown parser.
- **Token separation:** `STORYBLOK_TOKEN` is the MAPI personal access token (used by the CLI for schema push). `STORYBLOK_PREVIEW_TOKEN` and `STORYBLOK_PUBLIC_TOKEN` are CAPI tokens for draft and published content. Never use the MAPI token in browser-exposed code.
- **Env vars in `astro.config.mjs`:** Use `loadEnv` from `vite` — `import.meta.env` is not available in the config file.
- **Component name mapping:** `@storyblok/astro` camelCases component names before lookup. Schema component `stats_row` maps to file `StatsRow.astro`.
- **Schema push:** Use `storyblok schema push src/schema/schema.ts` via the `storyblok` CLI (installed as a dev dependency).
- **Monorepo workspace packages:** If `@storyblok/api-client` or other `workspace:*` dependencies are consumed from a monorepo, they must be built before the Astro dev server can resolve them. Run `pnpm nx build <package>` for each workspace dependency, then start the dev server. A "`.withTypes` is not a function" error typically means the package has no compiled `dist/`.
- **Self-signed cert and Playwright:** `@vitejs/plugin-basic-ssl` generates a self-signed certificate that Playwright rejects (`ERR_CERT_AUTHORITY_INVALID`). To verify rendering in the verify step, use `curl -sk https://localhost:4321/` instead. If you need Playwright, launch the browser, stop to let the user accept the certificate risk in the browser, then continue.
