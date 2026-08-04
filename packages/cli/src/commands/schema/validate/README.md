# Schema Validate Command

The `schema validate` command checks a local code-defined schema (`defineBlock()` / `defineDatasource()` / `defineFolder()` / `defineFieldPlugin()` from `@storyblok/schema`) for structural problems and unresolvable references.

It is fully offline: no login, no space, no API calls. Run it before `schema push` — or in CI on every commit — to catch a schema that would be rejected or would push something unintended.

## Basic Usage

```bash
storyblok schema validate ./src/storyblok/schema.ts
```

```
hero (block)
  ✖ unresolved_allow   blocks.hero.body.allow: Field "body" allows unknown block "gallery".
✖ 1 error, 0 warnings across 1 of 12 entities
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `<entry-file>` | (Required) Path to the TypeScript schema entry file | - |
| `--level <level>` | Display threshold: `error` hides warnings, `warning` shows everything | `warning` |
| `--format <format>` | Output format: `pretty` or `json` | `pretty` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No errors were found (warnings alone still exit `0`) |
| `1` | At least one error was found |
| `2` | The run never started: an invalid `--level`/`--format` value, or an entry file that cannot be resolved or exports no schema definitions |

## What Is Validated

Identity:

- `invalid_block_name` / `invalid_datasource_slug` — a block without a usable `name`, or a datasource without a usable `slug`. Neither can be pushed or referenced.
- `duplicate_block_name` / `duplicate_datasource_slug` — two definitions claiming the same identity. `schema push` rejects the same collision before it touches the API.
- `invalid_field` / `missing_field_name` / `duplicate_field_name` — a field entry the wire mapper would otherwise drop silently, or two fields sharing a name within one block.

Cross-references:

- `unresolved_allow` — a `bloks`/`richtext` field allows a block the schema does not define.
- `unresolved_datasource` — an `option`/`options` field references a datasource slug the schema does not define.
- `unresolved_field_plugin` — a `custom` field's `field_type` has no matching `defineFieldPlugin()` registration.

Every check resolves by name after the whole schema is collected, so forward and circular references are fine.

## JSON Output

`--format json` writes a single object to stdout and nothing else, so it can be piped. All human-facing output goes to stderr.

```bash
storyblok schema validate ./schema.ts --format json > report.json
```

```json
{
  "ok": false,
  "unit": "entities",
  "unitsTotal": 12,
  "unitsWithIssues": 1,
  "errors": 1,
  "warnings": 0,
  "fetchFailures": 0,
  "listFailed": false,
  "groups": [
    {
      "header": "hero (block)",
      "ref": { "kind": "block", "name": "hero" },
      "issues": [
        {
          "severity": "error",
          "code": "unresolved_allow",
          "path": ["blocks", "hero", "body", "allow"],
          "entity": "block:hero",
          "message": "Field \"body\" allows unknown block \"gallery\"."
        }
      ]
    }
  ]
}
```

- `ref` is the machine-readable identity of a group — use it instead of parsing `header`.
- The counts are always true totals. `--level` only filters which issues appear under `groups`.

## Notes

- Blocks, datasources, folders, and field plugins are read from the entry file's exports, directly or via an exported `schema` object. A definition that is not exported is not validated — and would not be pushed either.
- A datasource-only entry file is valid here (unlike `stories validate`, which needs blocks to check content against).
- This command validates the schema, not content. To check a space's stories against the same schema, use [`stories validate`](../../stories/validate/README.md).
