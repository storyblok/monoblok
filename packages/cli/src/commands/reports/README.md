# Reports Command

The `reports` command lets you inspect and manage run reports.

## Subcommands

### `list`

Show available report artifacts for the selected space.

```bash
storyblok reports list --space YOUR_SPACE_ID
```

### `prune`

Delete stored reports.

```bash
storyblok reports prune --space YOUR_SPACE_ID [--keep <count>]
```

Options:
- `--keep <count>` retains the most recent `count` reports and deletes the rest (default `0`, meaning remove all).

Note: use the same `--path` option you used when running the command producing the reports.
