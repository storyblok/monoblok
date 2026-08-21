# @storyblok/migrations Scenarios

| Scenario                      | Seeds                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `has-rich-content`            | 2 components (qa_rich_page, qa_rich_teaser) with richtext + asset + multiasset + multilink fields, and 2 stories. The richtext carries a `linktype: "story"` link mark and an embedded `type: "blok"` node, both of which `mapRefs` has to walk. |
| `has-various-components`      | 3 components (qa_page, qa_hero, qa_cta) with various field types (text, asset, multiasset, multilink, bloks, options, richtext).                                                                                                                 |
| `has-datasource-values`       | 1 datasource with entries, 1 component with options field, and 2 stories using those values.                                                                                                                                                     |
| `has-cross-references`        | Source space: 2 components, 3 stories with cross-references. Seed with `--space $STORYBLOK_SPACE_ID`.                                                                                                                                            |
| `has-cross-references-target` | Target space: same components, 3 plain stories. Seed with `--space $STORYBLOK_SPACE_ID_TARGET`.                                                                                                                                                  |

A story's `uuid` and a multilink's `id` are both real uuid strings, and the same slug carries the
same uuid in the source and target scenarios. Fixtures previously used the numeric story id here,
which `mapRefs` skips, so the one scenario built to exercise remapping could not have detected a
broken remap.
