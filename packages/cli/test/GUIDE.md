# Manually Test the Storyblok CLI

## Perform tests

- Run CLI commands with `./dist/index.mjs` (for available commands, run `./dist/index.mjs --help`).
- Review command documentation in `./src/commands/COMMAND/README.md` or `./src/commands/COMMAND/ACTION/README.md`.
- Verify changes in the local file system or the Storyblok space.
- Many commands require files in `./.storyblok/$STORYBLOK_SPACE_ID/COMMAND_DIR` to perform a test. Create files in this directory when necessary. For example, when pushing a story, create it in `./.storyblok/$STORYBLOK_SPACE_ID/stories/SLUG_FAKE_UUID.json`.
- **Testing `assets push`**: run `assets pull` first to populate `.storyblok/assets/$STORYBLOK_SPACE_ID/` with local files, then run `assets push` against those files. If testing `--update-stories`, also run `components pull` beforehand — without local component schemas the story scan is silently skipped.

### Scenario seeds

Use the provided [scenarios](./scenarios/SCENARIOS.md) to quickly seed QA spaces with predictable data for manual testing. Scenarios expect a clean space, so run cleanup first when you want a fresh start.

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-nested-stories \
  --scenario-dir packages/cli/test/scenarios
```

## Known quirks

- **Progress bar titles show `{title}` literally** — all progress bars render the raw `{title}` placeholder instead of the actual label. This is a known rendering issue and does not affect functionality. Ignore it when reading command output.

## Troubleshooting

- Find reports and logs in `./.storyblok/logs` and `./.storyblok/reports`.
