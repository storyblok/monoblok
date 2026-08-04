# Stories Validate Command

The `stories validate` command checks the content of every story in a space against a local code-defined schema (`defineBlock()` / `defineDatasource()` / `defineFieldPlugin()` from `@storyblok/schema`). It is a read-only command: nothing in the space is modified.

Use it to catch content that no longer fits the schema — a block removed from the code, a field renamed, a required field never filled in, an option value that no longer exists.

## Basic Usage

```bash
storyblok stories validate --space YOUR_SPACE_ID --schema ./src/storyblok/schema.ts
```

```
home (story #12345)
  ✖ missing_required_field   content.headline: Missing required field "headline" on component "page".
  ⚠ unknown_field            content.legacy_cta: Unknown field "legacy_cta" on component "page".
✖ 1 error, 1 warning across 1 of 17 stories
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space whose stories are validated | - |
| `--schema <entry-file>` | (Required) Path to the TypeScript schema entry file | - |
| `--starts-with <path>` | Only validate stories whose path starts with this prefix (e.g. `en/blog/`) | - |
| `--level <level>` | Display threshold: `error` hides warnings, `warning` shows everything | `warning` |
| `--format <format>` | Output format: `pretty` or `json` | `pretty` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Every story validated and no errors were found (warnings alone still exit `0`) |
| `1` | At least one error was found, or at least one story could not be fetched |
| `2` | The run never completed: bad invocation (missing `--space`/`--schema`, invalid `--level`/`--format`), an unusable schema entry file, or a failure listing the space's stories |

## What Is Validated

Content is checked against the blocks the entry file exports, directly or via an exported `schema` object:

- `unknown_component` (error) — the content names a block the schema does not define.
- `unknown_field` (warning) — the content carries a key the block does not declare.
- `missing_required_field` (error) — a `required` field is unset (`undefined`, `null`, or `''`, matching the backend's own check).
- `invalid_value` (error) — the value does not match the field type's wire shape (asset, multilink, richtext, table, number, boolean, …).
- `constraint_violation` (error) — the value breaks a declared bound (`max_length`, `min_value`, `steps`, `minimum`/`maximum`, …).
- `disallowed_component` (error) — an embedded block is not permitted by the field's `allow` list.
- `unknown_option` (error) — an `option`/`options` value is not among the options declared on the field.
- `async_validator_unsupported` (error) — a registered field plugin ships an asynchronous validator, which cannot be awaited during validation.

Option values are only checked for self-sourced fields. A field with a `source` (`internal` datasource, `internal_stories`, `internal_languages`, `external`) resolves its options inside the space, and a datasource definition carries no entries — entries are content, not schema — so those values are not knowable from local code.

> [!IMPORTANT]
> Validation runs against **draft** content, which is what the Management API returns for a story. A story that is published with valid content but has an invalid unpublished draft is reported as failing. There is no published-only mode: the Management API does not serve the published version of a single story.

## JSON Output

`--format json` writes a single object to stdout and nothing else, so it can be piped. All human-facing output (titles, progress, errors) goes to stderr.

```bash
storyblok stories validate --space YOUR_SPACE_ID --schema ./schema.ts --format json > report.json
```

```json
{
  "ok": false,
  "unit": "stories",
  "unitsTotal": 17,
  "unitsWithIssues": 1,
  "errors": 1,
  "warnings": 1,
  "fetchFailures": 0,
  "listFailed": false,
  "groups": [
    {
      "header": "home (story #12345)",
      "ref": { "kind": "story", "id": 12345, "slug": "home", "name": "Home" },
      "issues": [
        {
          "severity": "error",
          "code": "missing_required_field",
          "path": ["content", "headline"],
          "entity": "block:page",
          "message": "Missing required field \"headline\" on component \"page\"."
        }
      ]
    }
  ]
}
```

- `ok` is `true` only for a complete run with no errors. A failed listing (`listFailed`) or any story that could not be fetched (`fetchFailures`) makes it `false` even with zero issues.
- `listError` and `fetchErrors` carry the reasons behind an incomplete run, which a consumer reading only stdout would otherwise never see.
- `filter` echoes the option that narrowed the population (`{ "option": "--starts-with", "value": "en/" }`), and `noMatches: true` is added when that filter selected nothing. Both are omitted otherwise. A prefix that matches no story is still `ok: true`, so without these the document would be indistinguishable from a clean run over real content.
- `ref` is the machine-readable identity of a group — use it instead of parsing `header`.
- The counts are always true totals. `--level` only filters which issues appear under `groups`.
- Check the exit code before parsing: exit `2` means the run never produced a document, so stdout is empty and the reason is on stderr.

## Notes

- The entry file must export at least one block. A schema that defines none would report every story as `unknown_component`, so it is rejected as a bad invocation instead.
- Folders are skipped: they carry no content. They are excluded from the story total.
- Field-level translations (`headline__i18n__de`) are validated against the field they belong to, so a translated value is held to the same rules as the default one. `required` stays scoped to the default value — an untranslated locale is normal content, not a missing value.
- `--starts-with` is matched against `full_slug`, which never begins with a slash; a leading slash is stripped. When the prefix selects no stories the command says so rather than reporting a clean run over nothing.
- Group order is sorted by path, so output from two runs over identical content is diffable.

## Related

- [`schema validate`](../../schema/validate/README.md) — validate the schema itself, offline.
- `schema push` — push the code-defined schema to a space.
