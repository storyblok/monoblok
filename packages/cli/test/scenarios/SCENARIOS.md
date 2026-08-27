# @storyblok/cli Scenarios

Seed with:

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario <name> \
  --scenario-dir packages/cli/test/scenarios
```

For basic story testing, use the global `has-stories` scenario instead:

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-stories
```

| Scenario                   | Seeds                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `has-nested-stories`       | 2 story folders, each holding 2 nested stories with the same slugs (4 components, 6 stories). Exercises duplicate slugs across folders.                                                                                                                                  |
| `has-private-assets`       | 1 public asset and 1 private asset (4 components, 2 assets).                                                                                                                                                                                                             |
| `has-nested-asset-folders` | 2 nested asset folders (A → B) and 3 assets: 1 at root, 1 in Folder A, 1 in Folder B (4 components, 2 folders, 3 assets).                                                                                                                                                |
| `has-diverse-components`   | 6 components (1 root, 5 nestable) covering 20 of the 22 field types: text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, multiasset, image, file, link, multilink, bloks, table, section, tab, group, plus 1 datasource with entries. |
| `has-restrictions`         | 5 components, 2 nested component groups and 1 component tag, covering all eight `bloks` restriction shapes and four `richtext` ones. Baseline for `schema init`/`push` round trips over restrictions.                                                                    |

`kitchen_sink` carries the only `conditional_settings` in the corpus: `gallery` hides when `related`
is empty (one condition, `display` modification) and `legacy_file` becomes required when both
`notes` and `related` are filled (two conditions under `rule_match: 'all'`, `required`
modification). Between them they cover both modification kinds and both rule matches.

`kitchen_sink` also carries the shapes that only exist in older or API-authored spaces, so the round
trip has something to lose: `legacy_link` (`link`, the string-valued predecessor of `multilink`),
`reference_group` (`group`, the layout container that predates nesting fields under a `section`),
`legacy_image_cleared` (`image_width`/`image_height` as `""`, which is what clearing the crop inputs
writes), `headline.max_length` as a string, and `primary_reference` (a singular `option` sourced
from `internal_stories`, the only option source that holds a per-space reference).

Two of the 22 field types are deliberately absent, and both are covered by the `@storyblok/schema`
type tests instead:

- `custom`. The Management API rejects a component whose `custom` field names a field-type plugin
  the space has not installed, with
  `422 The following field-type plugin(s) are not available in this space`, so it cannot be seeded
  into an arbitrary QA space.
- `commerce`. A commerce integration owns the field, and whether a bare QA space accepts one is not
  something the corpus should assume.

## `has-restrictions`

Every `qa_restrictions` field and the first three `qa_rt_restrictions` fields are copied verbatim
from blocks created by hand in the Storyblok editor, so they are the shapes a real space holds:

- `r_allow` / `r_deny` / `r_allow_many` — the block-name dimension. The editor offers allow **or**
  block, never both, and always writes the paired empty list.
- `r_groups` — the folder dimension. It stores only the selected group's uuid; descendants resolve
  at read time, so `qa_gamma` in the nested `QA Sub` is allowed by a `QA Group` restriction without
  appearing in the list.
- `r_tags` / `r_tags_empty` — the tag dimension, with and without a tag selected. Tag ids are
  integers in the whitelist and strings in a component's `internal_tag_ids`.
- `r_on_nothing` — the restriction is switched on with nothing selected: no list keys at all.
- `r_off` — switched off; the Management API strips the name lists on `bloks` fields.

`rt_stale_tags_with_name` is the one field here the editor cannot produce. Switching dimension
clears all six lists, and the Management API only strips stale name lists on `bloks`, so a
`richtext` can hold `restrict_type: 'tags'` next to a live `component_whitelist` from legacy or
direct API writes. It is here to keep that path covered, not because a space would be authored that
way.
