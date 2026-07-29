# Schema Command

Manage a space's content model as versioned code.

## Subcommands

- `schema init` — bootstrap local TypeScript definitions from an existing space.
- `schema push` — apply local schema and datasource definitions to a space.
- `schema rollback` — revert a previous `schema push`.

## `schema init` options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) Space ID | - |
| `--out-dir <dir>` | Output directory for generated bootstrap files | `.storyblok/schema` |
| `--secret-names <names>` | Comma-separated custom-plugin option names to redact as `secret()`, added to the defaults (`accessKey`, `apiKey`, `apiToken`, `token`, `secret`, `clientSecret`, `password`, `privateKey`) | defaults |
| `--no-redact-secrets` | Write sensitive plugin option values verbatim instead of redacting them | redaction on |

## `schema push` options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) Space ID | - |
| `-p, --path <path>` | Path for file storage | - |
| `--dry-run` | Show diffs without applying changes | `false` |
| `--delete` | Delete remote entities not present in local schema | `false` |
| `--migrations` / `--no-migrations` | Generate scaffold migrations for breaking changes | `true` |
| `--write-components` / `--no-write-components` | Write component schemas as local JSON after push | `true` |
