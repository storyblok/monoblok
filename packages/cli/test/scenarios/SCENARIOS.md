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

| Scenario                   | Seeds                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `has-nested-stories`       | 2 story folders, each holding 2 nested stories with the same slugs (4 components, 6 stories). Exercises duplicate slugs across folders.                                                                                                                     |
| `has-private-assets`       | 1 public asset and 1 private asset (4 components, 2 assets).                                                                                                                                                                                                |
| `has-nested-asset-folders` | 2 nested asset folders (A → B) and 3 assets: 1 at root, 1 in Folder A, 1 in Folder B (4 components, 2 folders, 3 assets).                                                                                                                                   |
| `has-diverse-components`   | 6 components (1 root, 5 nestable) covering every field type: text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, multiasset, image, file, multilink, bloks, table, section, tab, custom, plus 1 datasource with entries. |
| `has-restrictions`         | 5 components, 2 nested component groups and 1 component tag, covering all eight `bloks` restriction shapes and four `richtext` ones. Baseline for `schema init`/`push` round trips over restrictions.                                                       |

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
