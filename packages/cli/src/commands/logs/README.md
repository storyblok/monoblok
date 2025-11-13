# Logs Command

The `logs` command lets you inspect and manage logs.

## Subcommands

### `list`

Show available run artifacts for the selected space.

```bash
storyblok logs list --space YOUR_SPACE_ID
```

### `prune`

Delete stored logs.

```bash
storyblok logs prune --space YOUR_SPACE_ID [--keep <count>]
```

Options:
- `--keep <count>` retains the most recent `count` runs and deletes the rest (default `0`, meaning remove all).

Note: use the same `--path` and `--log-file-dir` options you used when running the command producing the logs.
