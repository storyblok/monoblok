<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#flags (replace the table) -->

| Flag            | Type    | Description                                                                                                                         |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s` | integer | _Required._ The ID of the Storyblok space whose stories are validated.                                                              |
| `--schema`      | string  | _Required._ Path to the TypeScript schema entry file.                                                                               |
| `--starts-with` | string  | _Optional._ Only validate stories whose path starts with this prefix, for example `en/blog/`.                                       |
| `--level`       | string  | _Optional._ Display threshold: `error` hides warnings, `warning` shows everything. Defaults to `warning`.                           |
| `--format`      | string  | _Optional._ Output format: `pretty` or `json`. Defaults to `pretty`.                                                                |
| `--baseline`    | boolean | _Optional._ Only report the issues the local schema introduces, compared with the current schema of the space. Defaults to `false`. |

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx (new section after "Flags") -->

## Check a schema change before a push

With `--baseline`, the command reports only the issues a pending schema change introduces. Run it
before [`schema push`](/docs/tooling/cli/schema/push) to find the stories the change would break, or
in CI to block a breaking change.

The command validates every story twice:

- Against the current schema of the space.
- Against the schema the space has after `schema push <entry-file>`.

It reports only the issues of the second run that the first run doesn’t report, so content that’s
already invalid doesn’t count. Blocks that exist only in the space stay in the schema, as
`schema push` without `--delete` keeps them.

The exit code follows the same rules as without `--baseline`: `1` when the change introduces an
error, `2` when the command can’t run. The command also exits with `2` when it can’t read the
current schema of the space.

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#examples (add to the first code block) -->

```bash
# Report the stories a push of the local schema would break
storyblok stories validate --schema src/schema/schema.ts --baseline
```

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#json-output (append) -->

With `--baseline`, the report includes `"baseline": { "space": "<space-id>" }`, and `errors`,
`warnings`, and `groups` cover only the issues the local schema introduces.
