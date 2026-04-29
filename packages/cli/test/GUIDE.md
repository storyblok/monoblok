# Manually Test the Storyblok CLI

## Perform tests

- Run CLI commands with `./dist/index.mjs` (for available commands, run `./dist/index.mjs --help`).
- Review command documentation in `./src/commands/COMMAND/README.md` or `./src/commands/COMMAND/ACTION/README.md`.
- Verify changes in the local file system or the Storyblok space.
- Many commands require files in `./.storyblok/COMMAND_DIR/$STORYBLOK_SPACE_ID` to perform a test. Create files in this directory when necessary. For example, when pushing a story, create it in `./.storyblok/stories/$STORYBLOK_SPACE_ID/SLUG_FAKE_UUID.json`. **The `{uuid}` suffix must exactly match the `uuid` field inside the JSON** (use hyphens, not underscores). A mismatch causes `stories push` to silently skip the content-update pass — stories are created as empty placeholders with no error reported.

  ```
  # filename:
  .storyblok/stories/$STORYBLOK_SPACE_ID/my-story_my-fake-uuid.json

  # file content:
  { "slug": "my-story", "uuid": "my-fake-uuid", "name": "My Story", "content": { ... } }
  ```
- **Testing `assets push`**: run `assets pull` first to populate `.storyblok/assets/$STORYBLOK_SPACE_ID/` with local files, then run `assets push` against those files.
- IMPORTANT: When running `assets push --update-stories` or `stories push`, make sure you run `components pull` first!

### Scenario seeds

Use the provided [scenarios](./scenarios/SCENARIOS.md) to quickly seed QA spaces with predictable data for manual testing. Scenarios expect a clean space, so run cleanup first when you want a fresh start.

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-nested-stories \
  --scenario-dir packages/cli/test/scenarios
```

## Schema command

The `schema` command uses TypeScript entry files (not JSON). Test files must resolve `@storyblok/schema` imports.

### Module resolution

Test schema files placed outside a workspace package (e.g., `.claude/tmp/`) cannot resolve `@storyblok/schema`. Use absolute paths to the source instead:

```typescript
// Replace:
import { defineBlock } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';

// With:
import { defineBlock } from '/absolute/path/to/monoblok/packages/schema/src/index';
import { defineBlockFolder } from '/absolute/path/to/monoblok/packages/schema/src/mapi/index';
```

### Test patterns

**Round-trip (pull → push idempotency):**
```bash
# 1. Seed space with has-default-components
# 2. Pull
node ./dist/index.mjs schema pull --space "$STORYBLOK_SPACE_ID" --out-dir ../../.claude/tmp/schema-test
# 3. Replace @storyblok/schema imports with absolute paths (see above)
# 4. Push back — should show all entities as "unchanged"
node ./dist/index.mjs schema push ../../.claude/tmp/schema-test/schema.ts --space "$STORYBLOK_SPACE_ID" --dry-run --no-migrations
```

**Breaking changes & migrations:**
```bash
# Push a modified schema with --migrations to auto-generate migration files
node ./dist/index.mjs schema push ./schema-v2.ts --space "$STORYBLOK_SPACE_ID" --migrations --path ../../.claude/tmp/schema-test
# Inspect generated files in migrations/{spaceId}/
```

**Stale entity deletion:**
```bash
# Push a reduced schema with --delete to remove entities not in local schema
node ./dist/index.mjs schema push ./schema-reduced.ts --space "$STORYBLOK_SPACE_ID" --delete --no-migrations
```

**Rollback:**
```bash
# After a push, rollback using the changeset
node ./dist/index.mjs schema rollback .storyblok/schema/changesets/TIMESTAMP.json --space "$STORYBLOK_SPACE_ID"
```

### Changeset and migration storage

By default, changesets are saved to `.storyblok/schema/changesets/` relative to the CLI working directory. Use `--path` to redirect to a test directory (e.g., `--path ../../.claude/tmp/schema-test`). Migrations go to `migrations/{spaceId}/` under the same base path.

### Component-folder assignment

Assigning components to folders requires the folder's UUID (API-assigned). To test:
1. Push a schema with folders.
2. Pull to get UUIDs, or query MAPI: `components pull --space $STORYBLOK_SPACE_ID` then inspect `groups.json`.
3. Add `component_group_uuid: '<uuid>'` to component definitions and push again.

## Known quirks

- **Progress bar titles show `{title}` literally** — all progress bars render the raw `{title}` placeholder instead of the actual label. This is a known rendering issue and does not affect functionality. Ignore it when reading command output.
- **Spinner continues after error in `migrations run`** — when `readMigrationFiles` throws (e.g., missing directory), the spinner is not stopped before the error handler runs. The error message is still displayed correctly.

## Troubleshooting

- Find reports and logs in `./.storyblok/logs` and `./.storyblok/reports`.
