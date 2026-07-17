# Schema Diff Command

The `schema diff` command compares two schemas and reports what changed. Each side can be a remote space (by ID) or a local schema entry file, so you can diff space against space, file against space, or file against file.

## Basic Usage

Diff two spaces:

```bash
storyblok schema diff --from SOURCE_SPACE_ID --to TARGET_SPACE_ID
```

Diff a local schema entry file against a space:

```bash
storyblok schema diff --from ./schema/index.ts --to TARGET_SPACE_ID
```

Each source is auto-detected: a numeric value is treated as a space ID (fetched remotely), anything else is treated as a path to a schema entry file (loaded locally). Authentication is required only when a side points at a space.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--from <source>` | (Required) Base schema to compare against: a space ID or a path to a schema entry file | - |
| `--to <source>` | (Required) Target schema: a space ID or a path to a schema entry file | - |

## Output

By default the command prints a human-readable diff to the terminal, grouping entities into added, changed, and removed relative to `--to`, with field-level changes for each modified entity.

The full structured diff is also emitted through the reporter when reports are enabled (via the global `--report-enabled` flag). The report's `meta.diff` carries the entity-level actions and field-level changes, which is the machine-readable "diff file" downstream tooling reads, for example when replicating schema changes from one space to another.

The machine-readable payload uses the same vocabulary as `schema push`, which differs from the human wording:

- `meta.diff.entities[].action` is one of `create`, `update`, `stale`, or `unchanged` (the human output relabels these to added, changed, and removed relative to `--to`).
- `meta.diff.entities[].changes[].change` is one of `added`, `removed`, or `modified`, each with `before` and `after` values.

## Notes

- The direction matters: `--from` is the base and `--to` is the target. An entity present only in `--to` is reported as added, present only in `--from` as removed, and present in both but differing as changed.
- Unchanged entities are omitted from the terminal output to keep space-to-space comparisons readable. They still appear in the summary count and in the structured `meta.diff`.
- Component group UUIDs are per-space identifiers, so they are ignored unless both sides are local files. A component that differs only by its group assignment between two spaces is reported as unchanged.
- The classification is the same one `schema push` computes internally, exposed here as a read-only command.
