---
title: "schema affected"
description: "Reports which stories a pending schema change affects and which would break."
---

<!-- target: src/content/docs/docs/tooling/cli/schema/affected.mdx (new page) -->
<!-- navigation: src/config/navigation/tooling.ts, schema items: { label: "affected", link: "docs/tooling/cli/schema/affected" } -->

Reports which stories a pending schema change affects and which would break. The command compares
the schema exported from `<entry-file>` with the current schema of a space, then validates every
story that uses a changed block. It doesn’t change the space. Run it before
[`schema push`](/docs/tooling/cli/schema/push) to assess the impact on existing content, or in CI to
block a breaking change.

The command checks field changes (added, removed, or newly required fields and changed field types)
and, with `--include-deleted`, deleted blocks. It counts only validation errors that the change
introduces, so stories with already invalid content don’t count as broken. Changes to the allowed
blocks or options of a field don’t break existing content, so the command ignores them.

## Prerequisites

- Log in with [`storyblok login`](/docs/tooling/cli/account/login).
- An entry file that exports schema definitions authored with
  [`@storyblok/schema`](/docs/libraries/js/schema).
- To analyze local stories with `--local`, pull them first with
  [`stories pull`](/docs/tooling/cli/stories/pull).

## Usage

```bash
storyblok schema affected <entry-file> [flags]
```

## Arguments

| Argument   | Type   | Description                                                      |
| ---------- | ------ | ---------------------------------------------------------------- |
| Entry file | string | _Required._ Path to the TypeScript file that exports the schema. |

## Flags

| Flag                | Type    | Description                                                                                                                     |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`     | integer | _Required._ The ID of the space to compare the schema with.                                                                     |
| `--path`, `-p`      | string  | _Optional._ Base path to read local stories from with `--local`.                                                                |
| `--local`           | boolean | _Optional._ Analyze locally pulled stories instead of fetching them from the space.                                             |
| `--include-deleted` | boolean | _Optional._ Treat blocks that exist only in the space as deleted, like [`schema push --delete`](/docs/tooling/cli/schema/push). |
| `--fail-on-break`   | boolean | _Optional._ Exit with `1` when any story would break or when the command can’t read a story.                                    |

## Examples

```bash
# Report the stories that pushing the local schema affects
storyblok schema affected src/schema/schema.ts --space 123456

# Fail a CI job when the schema change breaks a story
storyblok schema affected src/schema/schema.ts --space 123456 --fail-on-break
```

The command prints the affected stories per block and field, followed by the totals:

```
hero (changed): 3 stories affected, 3 would break
  - badge (required_added): present in 0 stories, 3 would break

Totals: 3 stories affected across 1 component; 3 would break.
```

The [command report](/docs/tooling/cli/reports/list) includes the full result for each story and
field.
