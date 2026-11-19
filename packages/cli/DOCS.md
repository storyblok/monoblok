# Staged docs: `webhooks` commands

New pages under `src/content/docs/docs/tooling/cli/webhooks/`. Navigation entry for
`src/config/navigation/tooling.ts`, after `types` in the **Commands** group:

```ts
{
  collapsed: true,
  items: [
    { label: "create", link: "docs/tooling/cli/webhooks/create" },
    { label: "delete", link: "docs/tooling/cli/webhooks/delete" },
    { label: "get", link: "docs/tooling/cli/webhooks/get" },
    { label: "list", link: "docs/tooling/cli/webhooks/list" },
    { label: "update", link: "docs/tooling/cli/webhooks/update" },
  ],
  label: "webhooks",
},
```

<!-- target: src/content/docs/docs/tooling/cli/webhooks/list.mdx -->

```yaml
---
title: "webhooks list"
description: "Lists the webhooks of a Storyblok space."
---
```

Lists the webhooks of a Storyblok space. In a terminal, the command prints a table. Piped or
redirected, it prints one webhook per line as JSON (JSONL), ready for `jq` or for `webhooks update`
and `webhooks delete`. The output never contains a webhook’s signing secret.

## Usage

```bash
storyblok webhooks list [flags]
```

## Flags

| Flag      | Type    | Description                                                    |
| --------- | ------- | -------------------------------------------------------------- |
| `--space` | integer | _Required._ The ID of the Storyblok space to list webhooks of. |

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# List webhooks as a table
storyblok webhooks list

# Save every webhook as JSONL
storyblok webhooks list > webhooks.jsonl

# List the names of deactivated webhooks
storyblok webhooks list | jq -r 'select(.activated == false) | .name'
```

<!-- target: src/content/docs/docs/tooling/cli/webhooks/get.mdx -->

```yaml
---
title: "webhooks get"
description: "Prints one webhook of a Storyblok space."
---
```

Prints one webhook of a Storyblok space, without its signing secret. In a terminal, the command
prints one field per row. Piped or redirected, it prints the webhook as one line of JSON.

## Usage

```bash
storyblok webhooks get <webhook> [flags]
```

## Arguments

| Argument | Type   | Description                                                                                                                                       |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook  | string | _Required._ The ID or the name of the webhook. A value of only digits is an ID first: if no webhook has that ID, the command looks it up by name. |

## Flags

| Flag      | Type    | Description                                                  |
| --------- | ------- | ------------------------------------------------------------ |
| `--space` | integer | _Required._ The ID of the Storyblok space the webhook is in. |

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Print a webhook by name
storyblok webhooks get "Deploy preview"

# Print a webhook's endpoint
storyblok webhooks get 4521 | jq -r .endpoint
```

<!-- target: src/content/docs/docs/tooling/cli/webhooks/create.mdx -->

```yaml
---
title: "webhooks create"
description: "Creates webhooks in a Storyblok space from flags or from JSON on stdin."
---
```

Creates a webhook in a Storyblok space from flags, or one webhook per JSON object read from stdin.
The command prints one result line per webhook. The fields of a webhook:

| Field         | Type    | Description                                                                                                                     |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string  | _Required._ The name, unique in the space.                                                                                      |
| `endpoint`    | string  | _Required._ The URL that receives the webhook payloads.                                                                         |
| `actions`     | list    | _Required._ The events that trigger the webhook, called **Triggers** in the Storyblok app. Refer to the accepted actions below. |
| `description` | string  | _Optional._ A description.                                                                                                      |
| `secret`      | string  | _Optional._ The **Webhook secret** that signs each request. Available in paid plans.                                            |
| `activated`   | boolean | _Optional._ Whether the webhook sends requests. Defaults to `true`.                                                             |

The accepted actions:

- **Stories:** `story.published`, `story.unpublished`, `story.saved`, `story.deleted`, `story.moved`
- **Assets:** `asset.created`, `asset.replaced`, `asset.deleted`, `asset.restored`
- **Users:** `user.added`, `user.removed`, `user.roles_updated`
- **Datasources:** `datasource.entries_updated`, `datasource.entries_deleted`
- **Workflows, Releases, and Pipelines:** `stage.changed`, `release.merged`, `pipeline.deployed`
- **Discussions:** `discussion.created`, `discussion.resolved`, `discussion.comment_created`,
  `discussion.comment_updated`, `discussion.comment_deleted`
- **Experiments:** `experiment.created`, `experiment.started`, `experiment.paused`,
  `experiment.resumed`, `experiment.completed`, `experiment.winner_selected`, `experiment.deleted`

`story.saved` is only available in plans that include it. When the API rejects an action, the error
lists the actions the space accepts in `details.allowed_values`.

## Usage

```bash
storyblok webhooks create [flags]
storyblok webhooks create [flags] -
```

## Arguments

| Argument | Type | Description                                                                                                                                                                                              |
| -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-`      | –    | _Optional._ Read webhooks from stdin: JSONL, a single JSON object, or objects written back to back. The command ignores read-only fields, such as `id`, so the output of `webhooks list` works as input. |

## Flags

| Flag              | Type    | Description                                                                                                                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`         | integer | _Required._ The ID of the Storyblok space to create webhooks in.                                                                                                             |
| `--set`           | string  | _Optional._ Set a field as `<field>=<value>`. Repeat the flag for each field, once per field. Separate list values with commas: `actions=story.published,story.unpublished`. |
| `--data`          | string  | _Optional._ Fields as a JSON object, applied to each record from stdin. `--set` takes precedence over `--data`, which takes precedence over a record from stdin.             |
| `--if-not-exists` | boolean | _Optional._ Skip a webhook whose name exists in the space, so the command can run again without failing. The existing webhook keeps its settings.                            |
| `--dry-run`, `-d` | boolean | _Optional._ Validate the webhooks and print the result lines, with the fields in `_diff`, without creating anything.                                                         |

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Create a webhook
storyblok webhooks create \
  --set name="Deploy preview" \
  --set endpoint=https://example.com/deploy \
  --set actions=story.published,story.unpublished

# Create the webhook only if no webhook of that name exists, for example in CI
storyblok webhooks create --if-not-exists --data "$(cat webhook.json)"

# Copy every webhook from one space to another
storyblok webhooks list --space 12345 | storyblok webhooks create --space 67890 -
```

The output of `webhooks list` never contains signing secrets, so copied webhooks are unsigned. An
endpoint that verifies signatures rejects their requests until you set a secret with
`webhooks update`.

<!-- target: src/content/docs/docs/tooling/cli/webhooks/update.mdx -->

```yaml
---
title: "webhooks update"
description: "Updates webhooks in a Storyblok space from flags or from JSON on stdin."
---
```

Updates a webhook in a Storyblok space, or one webhook per JSON object read from stdin. The command
sends only the fields that change and skips a webhook nothing would change on. It prints one result
line per webhook.

A record from stdin addresses its webhook by `id`, or by `name` when it has no `id`. The command
compares every field the record carries with the webhook and sends the ones that differ. Fields the
record leaves out stay as they are.

A record that carries `updated_at`, as the output of `webhooks list` does, is only written if the
webhook hasn’t changed since the record was read. Otherwise, the record still holds the old values
of fields someone else changed, and writing it would undo those changes, so the command reports an
error for that record. Pass `--ignore-stale` to write it anyway. Two records for the same webhook
are applied in order.

## Usage

```bash
storyblok webhooks update <webhook> [flags]
storyblok webhooks update - [flags]
```

## Arguments

| Argument | Type   | Description                                                                        |
| -------- | ------ | ---------------------------------------------------------------------------------- |
| Webhook  | string | _Required._ The ID or the name of the webhook, or `-` to read webhooks from stdin. |

## Flags

| Flag              | Type    | Description                                                                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--space`         | integer | _Required._ The ID of the Storyblok space the webhooks are in.                                                          |
| `--set`           | string  | _Optional._ Set a field as `<field>=<value>`. Repeat the flag for each field, once per field.                           |
| `--unset`         | string  | _Optional._ Clear a field. Repeat for each field. Only `description` and `secret` can be cleared.                       |
| `--data`          | string  | _Optional._ Fields as a JSON object, applied as a JSON Merge Patch. `--set` and `--unset` take precedence.              |
| `--ignore-stale`  | boolean | _Optional._ Write records from stdin even if their webhook changed since they were read. This undoes the other changes. |
| `--dry-run`, `-d` | boolean | _Optional._ Print the changes, in a `_diff` field, without writing them.                                                |

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Deactivate a webhook
storyblok webhooks update "Deploy preview" --set activated=false

# Rotate a signing secret, passed on stdin so it stays out of the process list
printf '{"id":4521,"secret":"%s"}\n' "$NEW_SECRET" | storyblok webhooks update -

# Point every webhook at a new host, previewing the changes first
storyblok webhooks list \
  | jq -c '.endpoint |= sub("old.example.com"; "new.example.com")' \
  | storyblok webhooks update --dry-run -
```

<!-- target: src/content/docs/docs/tooling/cli/webhooks/delete.mdx -->

```yaml
---
title: "webhooks delete"
description: "Deletes webhooks from a Storyblok space."
---
```

Deletes a webhook from a Storyblok space, or one webhook per JSON object read from stdin. The
command asks for confirmation when both stdin and stderr are terminals. Otherwise, and when reading
from stdin, pass `--yes`.

## Usage

```bash
storyblok webhooks delete <webhook> [flags]
storyblok webhooks delete - --yes [flags]
```

## Arguments

| Argument | Type   | Description                                                                        |
| -------- | ------ | ---------------------------------------------------------------------------------- |
| Webhook  | string | _Required._ The ID or the name of the webhook, or `-` to read webhooks from stdin. |

## Flags

| Flag              | Type    | Description                                                                               |
| ----------------- | ------- | ----------------------------------------------------------------------------------------- |
| `--space`         | integer | _Required._ The ID of the Storyblok space to delete webhooks from.                        |
| `--yes`           | boolean | _Optional._ Delete without asking for confirmation. Required with `-`.                    |
| `--ignore-stale`  | boolean | _Optional._ Delete records from stdin even if their webhook changed since they were read. |
| `--dry-run`, `-d` | boolean | _Optional._ Print what the command would delete without deleting it.                      |

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Delete a webhook, after confirming
storyblok webhooks delete "Deploy preview"

# Delete every deactivated webhook
storyblok webhooks list | jq -c 'select(.activated == false)' | storyblok webhooks delete --yes -
```

<!-- target: src/content/docs/docs/tooling/cli/webhooks/index.mdx (or a "Webhooks" section on each page) -->

## Access

The commands need a token with the `webhooks:read` scope, and `webhooks:write` for `create`,
`update`, and `delete`, from a user who can manage the space. Otherwise the Management API answers
with `403`. A space that doesn’t exist, or that the user can’t access, answers with `404`, the same
as a missing webhook.

## Output and errors

Every write prints one line per webhook it handled:

```text
{"id":4521,"name":"Deploy preview","action":"update"}
{"id":4522,"name":"Search index","action":"skip","_skipped":true,"_reason":"unchanged"}
```

`action` is `create`, `update`, `delete`, or `skip`. A skipped webhook carries `_skipped: true` and
a `_reason`: `exists` (with `--if-not-exists`), `unchanged`, or `not_found` (a webhook the space no
longer has). A dry run adds `_dry_run: true`, and for `create` and `update` the fields it would
write in `_diff`, each as `{ "from": …, "to": … }`. A signing secret shows as
`"secret": "[changed]"`, never as its value. On a terminal, the commands print a table instead, and
long output opens in your pager.

A webhook that fails gets an error on stderr instead of a result line, and the command continues
with the next one. A rejected access token stops the run. When stderr isn’t a terminal, it holds
only errors, each as one line of JSON:

```text
{"error":"The Management API rejected the request.","status":422,"details":{"name":["has already been taken"]},"line":2,"id":4522}
```

`line` is the position of the record on stdin, counted from 1. For JSONL, it’s the line number.
`details` holds the field errors of the Management API.

The exit codes:

| Code | Meaning                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------- |
| `0`  | Every webhook was written or skipped.                                                              |
| `1`  | At least one webhook failed, or the Management API rejected the request.                           |
| `2`  | The command can’t run as called: a missing login, an invalid flag, or a missing target or `--yes`. |

The commands read stdin only when passed `-`. A record from stdin can carry any field: the commands
ignore read-only and unknown fields, so the output of `webhooks list` works as input. A dry run
validates required fields, actions, and name conflicts, but only a real run checks plan limits and
endpoint addresses. Like every run, a dry run writes its log and report files, without the signing
secret.
