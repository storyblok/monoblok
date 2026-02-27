---
name: migrate-to-storyblok
description: Help migrate a third-party website or CMS to Storyblok by generating component schemas from screenshots or URLs and pushing them with the Storyblok CLI.
---

# Migrate to Storyblok

Guide the user through creating Storyblok component schemas that match their existing website or CMS, then push those schemas to their Storyblok space.

## When to use

Use this skill when the user wants to:

- Migrate a website from a third-party CMS (WordPress, Drupal, Contentful, Sanity, etc.) to Storyblok.
- Model an existing website's structure as Storyblok components from a screenshot or a URL.
- Scaffold component schemas quickly to start a new Storyblok project based on an existing design.

## Overview

The workflow has four phases:

1. **Resolve the target space** — find the space ID from config or ask the user.
2. **Analyze the source** — fetch the URL or examine the screenshot to identify UI sections.
3. **Generate component schemas** — copy and adapt templates or create new JSON files.
4. **Push to Storyblok** — run `storyblok components push`.

## Phase 1: Resolve the target space

Find the space ID by checking, in order: the `space` field in any `storyblok.config.*` file (root, `.storyblok/config.*`, or `~/.storyblok/config.*`); the `STORYBLOK_SPACE_ID` environment variable in `.env` files; subdirectory names under `.storyblok/components/` (each is a previously pulled space ID). If none of these yield a space ID, ask the user: "What is the ID of your Storyblok space? You can find it under Settings > Space in the Storyblok dashboard."

## Phase 2: Analyze the source

### From a URL

1. Fetch the URL.
2. Analyze the HTML structure:
   - Identify distinct page sections using semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`.
   - Look for repeating patterns (card grids, FAQ lists, testimonial carousels).
   - Note headings, body text, images, links, forms, and lists within each section.
3. For each section, determine:
   - A descriptive section name (e.g., "Hero banner," "Feature grid," "Testimonial slider").
   - The UI elements it contains and which Storyblok field types they map to.
   - Whether it can be composed from existing templates or needs a custom schema.
4. If the page is JavaScript-rendered and the HTML is sparse, note this and rely on structural inference and common patterns.

### From a screenshot

1. Visually analyze the screenshot using your vision capabilities (e.g. Playwright MCP).
2. Identify distinct UI regions and section boundaries (whitespace, background color changes, dividers).
3. For each region, determine:
   - A descriptive name.
   - The visual elements present: text hierarchy (headline vs. body vs. caption), images, buttons, icons, form fields, lists.
   - The likely Storyblok field types (e.g., a large heading + image → `hero`; a grid of icon + title + text cards → `feature_grid` + `feature`).

### Present the findings

After analysis, present a numbered list of all identified sections for each. Example:

```
Sections identified on https://example.com:

1. Full-width banner with headline, subtitle, and two CTAs → hero
2. Three-column icon + title + text grid → feature_grid (contains: feature)
3. Quote carousel with author photo → testimonial
4. Accordion of questions and answers → faq_section (contains: faq_item)
5. Full-width CTA strip with email signup → cta
6. Rich text article body → richtext_section
7. Footer with logo and nav links → custom (no matching template)

Which sections should I create components for? (Enter numbers, e.g. "1 2 3 4" or "all")
```

Wait for the user's selection before proceeding.

## Phase 3: Generate component schemas

### Check for naming conflicts

Before writing any files, list the contents of `.storyblok/components/<SPACE_ID>/` (if it exists). If a file with the same name as a component you are about to create already exists, warn the user:

```
Warning: hero.json already exists in .storyblok/components/<SPACE_ID>/.
Pushing will update the existing component. Rename to avoid overwriting (e.g., site_hero)?
```

### Template-based generation

For sections that match a template, read the template from `templates/components/` (relative to this `SKILL.md`), adapt it, and write it to `.storyblok/components/<SPACE_ID>/`.

**Rules when adapting a template:**

- Set `"component_group_uuid": null` — always. This is required by the CLI.
- Keep placeholder IDs (e.g., `1001`). The API assigns real IDs on first push.
- Rename `name` and `display_name` to match what the user's site calls the section.
- Add, remove, or rename schema fields to match the actual content.
- Update `component_whitelist` in `bloks` fields if the section composes other generated components.

**Template to section mapping:**

| Section type | Template | is_root | is_nestable |
|---|---|---|---|
| Top-level page / content type | `page.json` | `true` | `false` |
| Hero / banner | `hero.json` | `false` | `true` |
| Single feature card | `feature.json` | `false` | `true` |
| Grid of features | `feature_grid.json` | `false` | `true` |
| Card / teaser / listing item | `teaser.json` | `false` | `true` |
| Call to action strip | `cta.json` | `false` | `true` |
| Blog post / article | `blog_post.json` | `true` | `false` |
| Image gallery | `gallery.json` | `false` | `true` |
| Testimonial | `testimonial.json` | `false` | `true` |
| Single FAQ entry | `faq_item.json` | `false` | `true` |
| FAQ section / accordion | `faq_section.json` | `false` | `true` |
| Announcement / alert bar | `banner.json` | `false` | `true` |
| Freeform editorial content | `richtext_section.json` | `false` | `true` |

### Custom component generation

For sections with no matching template, create a new JSON file from scratch:

```json
{
  "id": 2000,
  "name": "component_name",
  "display_name": "Component display name",
  "component_group_uuid": null,
  "is_root": false,
  "is_nestable": true,
  "schema": {
    "field_name": { "type": "text", "pos": 0, "display_name": "Field label" }
  },
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

Use unique placeholder IDs (2000, 2001, 2002, …) for custom components to avoid collisions with template IDs.

### File placement

Write each component to:

```
.storyblok/components/<SPACE_ID>/<component_name>.json
```

Create the directory if it does not exist.

## Field type reference

Use this table when mapping UI elements to Storyblok field types:

| UI element | Field type | Key options |
|---|---|---|
| Short text, headline, label | `text` | `required`, `regex`, `maxlength` |
| Multi-line description, excerpt | `textarea` | `required`, `maxlength` |
| Rich editorial content (HTML) | `richtext` | — |
| Markdown content | `markdown` | — |
| Numeric value | `number` | `minimum`, `maximum` |
| Date or date-time picker | `datetime` | — |
| Toggle / checkbox | `boolean` | `default_value: "true" \| "false"` |
| Single image or file | `asset` | `filetypes: ["images"]` |
| Multiple images or files | `multiasset` | `filetypes: ["images"]` |
| Internal or external link | `multilink` | `restrict_content_types` |
| Single select from datasource | `option` | `source: "internal_datasources"`, `datasource_slug` |
| Multi select from datasource | `options` | `source: "internal_datasources"`, `datasource_slug` |
| Nested components (blocks) | `bloks` | `restrict_components`, `component_whitelist` |
| Tabular data | `table` | — |
| Group | `section` | Groups fields visually in the editor — carries no runtime data |
| Plugin / custom field | `custom` | Requires plugin installed in the space |

### Field type notes

- **`option` / `options` with a static list**: Omit `source` and provide `options: [{ "name": "Label", "value": "value" }]` instead of a datasource.
- **`bloks` with child components**: Set `"restrict_components": true` and list allowed component names in `"component_whitelist"`. Add all referenced components to the same push.
- **`custom` fields**: The relevant plugin must be installed in the Storyblok space. Add a `display_name` comment in the JSON to explain the intended plugin (e.g., `// requires 'fontawesome-selector' plugin`). Advise the user to configure this manually in the Storyblok editor (try to avoid this field type).

## Phase 4: Push components to Storyblok

### Prerequisites

The Storyblok CLI must be available. Install it first if needed:

```bash
npm install -g storyblok@latest
```

### Push command

```bash
storyblok components push --space <SPACE_ID> --separate-files
```

**Common options:**

| Option | Description |
|---|---|
| `--space <id>` | Target space ID (required if no config file) |
| `--separate-files` | Read one JSON file per component (use this; files are in separate-file format) |
| `--filter "hero*"` | Push only components whose names match the glob |
| `--path <path>` | Override the base path (default: `.storyblok`) |
| `--dry-run` | Preview what would be pushed without making changes (if supported) |

### After the push

The CLI will create or update components in the space. Confirm success by checking the Storyblok editor under **Components** in the sidebar. Placeholder IDs in the JSON files are replaced with real IDs only after a pull (`storyblok components pull`); the push itself uses the `name` field to match components.

## Content migration tips

Component schemas define the structure. To migrate content into those structures:

### Map existing fields to new schema fields

Draw a mapping table before writing any migration code:

| Source field | Storyblok component | Storyblok field | Notes |
|---|---|---|---|
| `wp_post.post_title` | `blog_post` | `title` | Plain string |
| `wp_post.post_content` | `blog_post` | `body` | HTML → Storyblok richtext |
| `wp_post.thumbnail_url` | `blog_post` | `featured_image` | URL → Storyblok asset upload |
| `wp_post.categories[0]` | `blog_post` | `category` | Datasource value |

### HTML to richtext conversion

Storyblok richtext is a ProseMirror document (JSON). The `@storyblok/richtext` package provides helpers to build the structure programmatically. For simple HTML, you can use the Storyblok HTML-to-richtext converter available in the Storyblok ecosystem.

### Asset migration

Assets must be uploaded to Storyblok before they can be referenced in stories. Use the `storyblok assets push` command or the Management API to upload files, then map returned asset IDs/URLs to the relevant fields.

### Story creation

Once components are pushed, create stories via the Management API or `storyblok stories push`. Each story's `content.component` must match the `name` of one of the pushed components.

### Use the migrations package

`@storyblok/migrations` provides helpers for common migration tasks:
- `urlToLink()` — converts plain URLs to Storyblok multilink objects.
- `urlToAsset()` — resolves asset URLs to Storyblok asset references.
- `mapRefs()` — remaps story/asset UUIDs between spaces.

## Output summary template

After generating components, provide this summary:

```md
## Component generation summary

- **Space ID:** `<SPACE_ID>`
- **Output directory:** `.storyblok/components/<SPACE_ID>/`

### Generated components

| File | Component name | Based on | is_root | Fields |
|---|---|---|---|---|
| `hero.json` | `hero` | template: `hero` | No | title, subtitle, background_image, cta_label, cta_link |
| `feature_grid.json` | `feature_grid` | template: `feature_grid` | No | headline, subheadline, features (bloks) |
| `feature.json` | `feature` | template: `feature` | No | icon, title, description, link |
| `footer.json` | `footer` | custom | No | logo, columns (bloks) |

### Naming conflicts

- (none) or list any files that already existed and will be updated on push.

### Next steps

1. Review the generated JSON files in `.storyblok/components/<SPACE_ID>/`.
2. Push the components:
   \`\`\`bash
   storyblok components push --space <SPACE_ID> --separate-files
   \`\`\`
3. Verify components appear in the Storyblok editor under **Components**.
4. Begin mapping and migrating content.
```
