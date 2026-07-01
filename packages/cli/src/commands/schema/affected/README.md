# Schema Affected Command

The `schema affected` command reports which stories a pending schema change affects and which would break. It is a read-only dry run of `schema push`: it diffs your local code-first schema against the remote space, then checks every story that uses a changed component for breakage.

## Basic Usage

Point the command at your schema entry file and target space:

```bash
storyblok schema affected ./schema/index.ts --space YOUR_SPACE_ID
```

The summary lists each impacted component with the number of stories affected, how many would break, and the field-level change that causes it:

```
hero (changed): 3 stories affected, 3 would break
  - badge (required_added): present in 0 stories, 3 would break

Totals: 3 stories affected across 1 component; 3 would break.
```

Gate a CI pipeline by failing the run when any story would break:

```bash
storyblok schema affected ./schema/index.ts --space YOUR_SPACE_ID --fail-on-break
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to diff against | - |
| `-p, --path <path>` | Base path where local stories are read from with `--local` (stories live under `<path>/stories`) | `.storyblok` |
| `--local` | Analyze locally pulled stories instead of fetching from the space | `false` |
| `--include-deleted` | Treat remote-only components as deleted, mirroring `schema push --delete` | `false` |
| `--fail-on-break` | Exit with a non-zero code when any story would break, for CI gating | `false` |

## Notes

- The analysis covers field-structural changes (field add, remove, type change, newly required fields) and component deletion (`--include-deleted`). It does not flag nested allow-list or reference constraint changes, because Storyblok tolerates orphaned nested bloks, so existing content is not broken by those changes.
- Breakage is diffed against both the old and new schema, so only errors the change introduces are counted. Pre-existing invalid content is not misattributed.
- By default the command fetches only the stories that use an impacted component (as a nested blok or as their root content type) directly from the space. Use `--local` to analyze already-pulled story JSON instead. Run `storyblok stories pull --space YOUR_SPACE_ID` first.
- The full per-story and per-field detail is written to the standard command report file when reporting is enabled (`--report-enabled`).
