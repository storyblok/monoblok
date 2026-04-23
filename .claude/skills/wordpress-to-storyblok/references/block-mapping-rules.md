# WordPress block mapping rules

How the data-driven block discovery in `discover-schema.ts` and `_block-mapper.ts` decides what becomes a Storyblok component vs what collapses into a richtext run.

## Three categories of WP block

### 1. Prose blocks — collapse into richtext

These block names are special-cased and never become standalone Storyblok components. Consecutive runs of them (within the same parent) merge into a single `richtext` blok whose `body` field holds a Storyblok-native `RichtextFieldValue` produced by `htmlToStoryblokRichtext()`.

- `core/paragraph`
- `core/heading`
- `core/list`
- `core/list-item`
- `core/quote`
- `core/code`
- `core/preformatted`
- `core/table`
- `core/separator`

Why: editors expect rich text to be one editable body, not a series of single-paragraph bloks. Round-tripping fidelity is excellent for typical inline marks (`<strong>`, `<em>`, `<a>`, `<code>`) because the underlying converter is a TipTap-based parser.

### 2. Promotable blocks — surfaced under their `className` if it starts with `sbp-`

These three blocks are commonly used as wrappers in block themes. When they carry a sentinel className like `sbp-hero`, `sbp-feature-grid`, `sbp-testimonial` etc., the mapper strips the `sbp-` prefix and uses the remainder as the **effective component name** (with `-` → `_`).

- `core/cover` → `hero` if `className: "sbp-hero ..."`, else `cover`
- `core/group` → `feature_grid` if `className: "sbp-feature-grid ..."`, else `group`
- `core/columns` → similar

Why: real WP installations often express semantic intent through CSS class hooks (custom block patterns, theme.json, ACF block templates). Without this rule, dozens of distinct landing-section variants would collapse into a single generic `cover` component with overloaded fields.

A WP installation that doesn't use sentinel classes simply gets the default `cover` / `group` / `columns` components. No special configuration required.

### 3. Everything else — one component per unique block name

Every other block name encountered in any `post_content` becomes a nestable Storyblok component. This includes:

- Other core blocks: `core/image`, `core/cover` (without sentinel className), `core/columns`, `core/gallery`, `core/media-text`, `core/embed`, `core/buttons`, `core/group`, `core/spacer`, `core/navigation`, …
- Plugin blocks: `acf/hero`, `my-plugin/cta`, `woocommerce/product-grid`, …
- Custom theme blocks: `themename/showcase`, …

The block name → component name transform: strip `core/` prefix, then replace `/` and `-` with `_`. Examples:

| WP block name | Component name |
|---|---|
| `core/cover` | `cover` |
| `core/media-text` | `media_text` |
| `acf/hero` | `acf_hero` |
| `themename/cta-stack` | `themename_cta_stack` |

## Schema discovery for "everything else" blocks

For each unique block name found, the discoverer:

1. Unions every `attrs` key observed across all instances of that block, excluding WordPress-internal keys (`id`, `className`). Each becomes a Storyblok field.
2. Infers the field type from value shapes (`string`/`url`/`datetime`/`number`/`boolean`/`object`/`array`/`longtext`). URL-shaped strings become `asset` fields.
3. If any instance has `innerBlocks`, adds a `body` (bloks) field. The `component_whitelist` is the union of inner block names actually observed inside this block.

Example: a `core/cover` whose attrs across the dump include `url`, `dimRatio`, `minHeight`, `align`, `isDark` produces a `cover` component with five fields (asset, number, number, text, boolean) plus a `body` bloks field if any cover ever had inner blocks. The `id` and `className` attrs are excluded because they are WordPress-internal.

## What's NOT discovered automatically

- **Inner-HTML content** of structural blocks. The mapper recurses `innerBlocks` for structural children but ignores the wrapping HTML segments (e.g., `<div class="wp-block-cover__inner-container">…</div>`). Custom blocks whose meaningful content is inside `innerHTML` (rather than `attrs` or `innerBlocks`) get an incomplete component schema. Refine by hand in `src/schema/components/`.
- **Implicit relationships.** A `wp:button` whose `href` points at `/about/` is just a string — it's not surfaced as a `multilink` to the about story. This is a known v1 limitation; resolution would require a second-pass content rewriter that consults the registry.
- **Cross-language fields.** The mapper ignores `__i18n__<locale>` suffixes.

## Edge cases

- **Unknown block (no `blockName`).** WP's parser produces "freeform content" blocks for raw HTML between block markers. The mapper names these `unknown_block`. They almost always show up as artifacts of legacy content imports.
- **Custom blocks with wildly varying attributes.** A block whose attrs differ a lot between instances gets a union schema with many optional fields. Manageable, but the resulting Storyblok component may need consolidation.
- **Empty content.** A post with no blocks produces an empty `body: []`. Fine.

## Tuning for a specific WP installation

The mapper is deliberately rule-light. To change behavior:

- Add to `PROSE_BLOCKS` in `_block-mapper.ts` to fold more block names into richtext.
- Add to `PROMOTABLE` to allow more block types to be surfaced under `className`.
- Change `PROMOTION_PREFIX` to match a different convention than `sbp-`.

For schema-level customization (renaming fields, adding required constraints, splitting one component into many) — edit the generated files in `src/schema/` directly after the initial migration setup is complete.
