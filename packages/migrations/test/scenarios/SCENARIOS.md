# @storyblok/migrations Scenarios

| Scenario | Seeds |
| --- | --- |
| `has-rich-content` | 1 component (qa_rich_page) with richtext + asset + multilink fields, and 2 stories with sample content. |
| `has-various-components` | 3 components (qa_page, qa_hero, qa_cta) with various field types (text, asset, multiasset, multilink, bloks, options, richtext). |
| `has-datasource-values` | 1 datasource with entries, 1 component with options field, and 2 stories using those values. |
| `has-cross-references` | Source space: 2 components, 3 stories with cross-references. Seed with `--space $STORYBLOK_SPACE_ID`. |
| `has-cross-references-target` | Target space: same components, 3 plain stories. Seed with `--space $STORYBLOK_SPACE_ID_TARGET`. |
