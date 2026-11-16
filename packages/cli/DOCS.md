<!-- target: src/content/docs/docs/tooling/cli/schema/push.mdx (intro paragraph, replaces the sentence starting "Each successful run") -->

Each run that changes the space saves a changeset file under the configured base path, so you can
revert the push with [`schema rollback`](/docs/tooling/cli/schema/rollback).

<!-- target: src/content/docs/docs/tooling/cli/schema/push.mdx#changesets (replaces the section body) -->

A push that changes the space writes a changeset file capturing the diff and the pre-push remote
state. The command writes the changeset before it applies any change, so you can also roll back a
push that fails midway. A dry run, or a push with nothing to push, writes no changeset. The
changeset is the input consumed by [`schema rollback`](/docs/tooling/cli/schema/rollback).

<!-- target: src/content/docs/docs/tooling/cli/schema/rollback.mdx (intro, replaces both paragraphs) -->

Loads a changeset written by a previous [`schema push`](/docs/tooling/cli/schema/push) and reverts
the Storyblok space to the state captured before that push. If you don’t pass a `changeset-file`,
the command lists the changesets of the space that have changes and prompts for one, unless
`--latest` selects the most recent automatically.

Applying a rollback writes a new changeset that captures the state before the rollback, letting you
revert the rollback. The command writes this changeset before it applies any change, so you can also
revert a rollback that fails midway.

## How a rollback applies changes

The rollback compares the changeset with the current state of the space:

- An entity the changeset updated or deleted that no longer exists in the space is skipped.
- A block or data source that the rollback restores and that already exists is updated, not created
  again.
- A block folder that already exists is reused.
- A changeset recorded for another space is refused.

A rollback changeset is the most recent changeset after a rollback, so running
`schema rollback --latest` twice reverts the rollback and reapplies the push.

<!-- target: src/content/docs/docs/tooling/cli/schema/rollback.mdx#flags (the --latest row) -->

| `--latest` | boolean | _Optional._ Automatically select the most recent changeset with changes for
the space. |

<!-- target: src/content/docs/docs/tooling/cli/schema/rollback.mdx#examples (the first example) -->

```bash
# Roll back the most recent push or rollback
storyblok schema rollback --latest
```
