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

## Shared asset libraries

A shared asset library is a top-level shared asset folder owned by the organization, with per-space read or write access. `assets pull` and `assets push` reach libraries through `--target` and `--library`. Library assets live under `.storyblok/assets/shared/<library_id>/`, parallel to the space subtree at `.storyblok/assets/<space_id>/`, each with its own `manifest.jsonl`.

```bash
# Pull only the readable libraries (writes .storyblok/assets/shared/<library_id>/).
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --target shared

# Pull the space plus every readable library.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --target all

# Push a single file into a library (folder defaults to the library root).
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID --target shared --library <libraryId> ./.storyblok/assets/shared/<libraryId>/qa-hero.png

# Push every local library subtree present on disk.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID --target shared
```

Notes for manual testing:

- A library must already exist before you can push to it. Libraries are root shared folders, which can only be created in org context (`POST /v1/orgs/{org_id}/shared_asset_folders` with `regions` and `asset_folder_access`), not from a space. Reuse an existing QA library when possible.
- Shared-asset creation requires an `asset_folder_id` the space can write to. A library push defaults it to the library root, so `--folder` is optional.
- The library root folder itself is skipped on bulk push (a space cannot push a root shared folder), while its child folders are pushed.
- `--target` accepts only `space`, `shared`, or `auto` for push, and `with-referenced`, `all`, `space`, or `shared` for pull. Unknown values fail fast.

### Cleaning up shared libraries safely

Shared libraries are org-global, so you must never wipe them wholesale. The `--shared` cleanup is scoped by folder membership: it deletes every shared asset in the given library's folder tree, every internal tag scoped to the library, and every child folder, but never the library root or anything outside the library. Because it removes all content inside the library regardless of name, only run it against a dedicated QA library:

```bash
# Inspect a library.
bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-assets --library <libraryId>
bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-folders
bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-tags --library <libraryId>

# Delete all shared resources in the library's folder tree (assets, child folders, tags).
bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh --shared --library <libraryId>
```

## Schema command

The `schema` command uses TypeScript entry files (not JSON). When test files live outside a workspace package (e.g. `.claude/tmp/`), they can't resolve `@storyblok/schema` — rewrite the imports to absolute source paths before pushing.

### Test patterns

**Round-trip (init → push idempotency):**
```bash
# 1. Seed space with has-default-components
# 2. Init
node ./dist/index.mjs schema init --space "$STORYBLOK_SPACE_ID" --out-dir ../../.claude/tmp/schema-test

# 3. Rewrite @storyblok/schema imports to absolute source paths (only needed when
#    the generated files live outside a workspace package, e.g. .claude/tmp/):
#    import { defineBlock } from '@storyblok/schema'
#    -> import { defineBlock } from '/abs/path/to/monoblok/packages/schema/src/index'
#    import { defineFolder } from '@storyblok/schema'
#    -> import { defineFolder } from '/abs/path/to/monoblok/packages/schema/src/index'

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
# After a push, rollback using the changeset. Rollback prompts for confirmation
# before applying, so pass --yes for non-interactive runs.
node ./dist/index.mjs schema rollback .storyblok/schema/changesets/TIMESTAMP.json --space "$STORYBLOK_SPACE_ID" --yes

# Roll back the most recent changeset without naming the file:
node ./dist/index.mjs schema rollback --latest --space "$STORYBLOK_SPACE_ID" --yes

# Preview the inverse operations without applying them:
node ./dist/index.mjs schema rollback --latest --space "$STORYBLOK_SPACE_ID" --dry-run
```

### Changeset and migration storage

By default, changesets are saved to `.storyblok/schema/changesets/` relative to the CLI working directory. Use `--path` to redirect to a test directory (e.g., `--path ../../.claude/tmp/schema-test`). Migrations go to `migrations/{spaceId}/` under the same base path.

### Component-folder assignment

Folders (component groups) are declared in code with `defineFolder` and assigned by name path, never by UUID. The CLI resolves paths to group UUIDs at push time. To test:
1. Declare folders with `defineFolder({ name, parent? })` and register them under `defineSchema({ folders })`.
2. Assign a block to a folder with `folder: <folderRef>` (or a `'Parent/Child'` path string, or `null` to explicitly ungroup).
3. Restrict a `bloks` or `richtext` field to a folder with `allow: [<folderRef>]`.
4. Push the schema. `schema push` creates missing groups parent-first, resolves membership to UUIDs, and (with `--delete`) removes stale groups children-first.

See `adr/0007-block-folder-identity-by-name-path.md` for the identity model.

## Known quirks

- **Progress bar titles show `{title}` literally** — all progress bars render the raw `{title}` placeholder instead of the actual label. This is a known rendering issue and does not affect functionality. Ignore it when reading command output.
- **Spinner continues after error in `migrations run`** — when `readMigrationFiles` throws (e.g., missing directory), the spinner is not stopped before the error handler runs. The error message is still displayed correctly.

## Troubleshooting

- Find reports and logs in `./.storyblok/logs` and `./.storyblok/reports`.
