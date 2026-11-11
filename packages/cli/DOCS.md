<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#flags (replace the table) -->

| Flag            | Type    | Description                                                                                               |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `--space`, `-s` | integer | _Required._ The ID of the Storyblok space whose stories are validated.                                    |
| `--schema`      | string  | _Required._ Path to the TypeScript schema entry file.                                                     |
| `--starts-with` | string  | _Optional._ Only validate stories whose path starts with this prefix, for example `en/blog/`.             |
| `--level`       | string  | _Optional._ Display threshold: `error` hides warnings, `warning` shows everything. Defaults to `warning`. |
| `--format`      | string  | _Optional._ Output format: `pretty` or `json`. Defaults to `pretty`.                                      |
| `--baseline`    | boolean | _Optional._ Only report issues a push of the local schema would add. Defaults to `false`.                 |

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx (new section after "Flags") -->

## Report all issues or only new ones

Without `--baseline`, the command reports every issue in the content. Use it to audit a space, or to
check it after a push or a content migration.

With `--baseline`, the command reports only the issues a push of the local schema would add. Use it
before [`schema push`](/docs/tooling/cli/schema/push), or in CI to block a breaking schema change.
Content that’s already invalid doesn’t count, and blocks that exist only in the space are kept, as
`schema push` without `--delete` keeps them. The command exits with code `2` when it can’t read the
schema of the space.

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#examples (add to the first code block) -->

```bash
# Report the stories a push of the local schema would break
storyblok stories validate --schema src/schema/schema.ts --baseline
```

<!-- target: src/content/docs/docs/tooling/cli/stories/validate.mdx#json-output (append) -->

With `--baseline`, the report adds `"baseline": { "space": "<space-id>" }`, and its counts and
`groups` cover only new issues.
