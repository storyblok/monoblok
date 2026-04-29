---
name: wordpress-to-storyblok
description: Migrate a WordPress installation (schema and data) to Storyblok. Triggers on phrases like "wp to storyblok", "wordpress migration", "migrate gutenberg", "import wordpress into storyblok".
---

# WordPress → Storyblok migration

This skill turns any WordPress dump into a Storyblok-ready migration project. Schema and data only — no frontend.

## When to use

The user wants to migrate a WordPress site (their own production WP, a staging instance, or a one-off dump from a client) into a Storyblok space. The skill discovers the content shape from the dump (post types, meta keys, Gutenberg block names, including custom-plugin and ACF blocks) and emits a Storyblok schema that fits **that** dump.

It does not assume anything about which blocks exist, which post types exist, or what custom fields are used.

## Inputs

The skill needs two paths:

- `--dump-dir <path>`: a directory shaped as `<dump-dir>/json/{posts,pages,attachments,terms,users,…}.json`, with upload binaries at `<dump-dir>/uploads/` whenever `attachments.json` contains file-backed attachments.
- `--out-dir <path>`: where to scaffold the migration project.

If either path is missing or ambiguous, **ask the user** before proceeding. Never guess.

## Required dump shape

The skill reads JSON metadata plus local upload binaries. SQL dumps and arbitrary export archives are not parsed directly by the migration scripts. Expected layout:

```
<dump-dir>/
  json/
    posts.json           # array of { ID, post_title, post_name, post_type, post_status, post_date, post_parent, post_author, post_content, meta, terms }
    pages.json           # same shape, post_type = 'page'
    landing_pages.json   # same shape (any custom post type works — file name = post_type pluralized)
    attachments.json     # array of { ID, guid, mime, alt, focal_x?, focal_y?, file_path }
    terms.json           # { taxonomy_slug: [{ term_id, name, slug, parent_id }] }
    users.json           # array of { ID, login, display_name, email }
  uploads/               # required when attachments.json has file_path values; copied from wp-content/uploads
```

If `<dump-dir>/json/` doesn't exist, produce it. Detect which of these the user has and take action — do not paste instructions back at the user.

Asset binaries are part of the dump contract. `attachments.json` is only metadata; Storyblok asset seeding needs the referenced files on disk. The bundled `wp-export/export-json.php` copies `wp_upload_dir()['basedir']` to `<dump-dir>/uploads` by default when `SBP_DUMP_DIR=<dump-dir>/json`. If using an older/custom exporter, copy `wp-content/uploads` yourself into either `<dump-dir>/uploads` or `<dump-dir>/wp-content/uploads` before running `pnpm wp:build`, `pnpm seed:assets`, or `pnpm migrate`.

**Branch A — WordPress on the host (`wp` CLI reachable from the shell).**

Check with `which wp && wp core is-installed`. If it succeeds, run the exporter directly:

```
SBP_DUMP_DIR=<dump-dir>/json wp eval-file <path-to-skill>/wp-export/export-json.php
```

The exporter writes JSON to `<dump-dir>/json` and copies upload binaries to `<dump-dir>/uploads`. To override the binary destination, pass `SBP_UPLOADS_DIR=<path>`.

**Branch B — WordPress in Docker / docker compose (the common case).**

Find the compose file (`compose.yaml` / `docker-compose.yml`, typically next to a WP `Dockerfile` or alongside the user's project). Identify the wp-cli service — look for service images matching `wordpress:cli*` (`grep -E 'image:.*wordpress:cli' compose.yaml`). If `docker compose ps` shows it's running alongside the WP stack, prefer `docker compose run` against that service. If the compose file has no wp-cli service, fall back to a one-shot `docker run` attached to the running WordPress container.

The exporter needs two things inside the container: the PHP script and a writable output directory.

When working inside the `monoblok` monorepo, do not inspect or open files under `packages/migrations/playground/wordpress-astro/wordpress/scripts/`. Treat that directory as off-limits; use the skill's bundled exporter in `<path-to-skill>/wp-export/` and the documented commands instead.

- With a wp-cli service:
  ```
  docker compose run --rm \
    -v <path-to-skill>/wp-export:/sbp-wp-export:ro \
    -v <host-output-dir>:/sbp-out \
    -e SBP_DUMP_DIR=/sbp-out/json \
    <wp-cli-service> eval-file /sbp-wp-export/export-json.php
  ```
  (Most `wordpress:cli` images use `wp` as the entrypoint, so the subcommand goes in directly. If the service's compose definition overrides the entrypoint, add `--entrypoint wp`.)
  This writes JSON to `<host-output-dir>/json` and upload binaries to `<host-output-dir>/uploads`.

- Without a wp-cli service, attach to the running WP container so volumes and DB config line up:
  ```
  docker run --rm \
    --volumes-from <wordpress-container> \
    --network container:<wordpress-container> \
    -v <path-to-skill>/wp-export:/sbp-wp-export:ro \
    -v <host-output-dir>:/sbp-out \
    -e SBP_DUMP_DIR=/sbp-out/json \
    wordpress:cli eval-file /sbp-wp-export/export-json.php
  ```
  Discover `<wordpress-container>` with `docker compose ps --format json` or `docker ps --filter ancestor=wordpress`.
  This writes JSON to `<host-output-dir>/json` and upload binaries to `<host-output-dir>/uploads`.

Verify by listing both `<host-output-dir>/json/` and `<host-output-dir>/uploads/` afterwards. If the exporter produced attachment rows but `<host-output-dir>/uploads/` is empty or missing, stop and fix the dump before generating seed files; do not continue to `seed:assets` because it will produce JSON sidecars without binaries and the CLI will process 0 assets.

**Branch C — Existing non-JSON dump (WXR, custom exporter, etc.).**

Not supported directly. Stop and tell the user: the skill needs the JSON shape above; converting WXR or another format is out of scope.

**If none of these apply** (can't locate the WP install, no compose file, no running container), stop and ask the user how to reach their WordPress. Don't guess.

## Steps the skill performs

### 0. Verify the dump

Check `<dump-dir>/json/` for `posts.json` (or any one of the canonical files). If missing, produce it via the branches above. **Never proceed without a valid dump.**

Then check asset completeness:

- If `attachments.json` is missing or has `[]`, uploads can be absent.
- If `attachments.json` contains entries with `file_path`, `<dump-dir>/uploads` or `<dump-dir>/wp-content/uploads` must exist and contain those relative files (for example `2026/04/image.jpg`).
- If files are missing, rerun the bundled exporter or copy `wp-content/uploads` out of the source WordPress install before continuing.

In Docker/Compose workflows where you must repair an old dump manually, copy from the running WordPress container into the dump root:

```
docker compose cp <wordpress-service>:/var/www/html/wp-content/uploads <dump-dir>/uploads
```

Only use this as a repair path. Prefer rerunning the bundled exporter because it writes JSON and uploads in one pass.

### 1. Scaffold the migration project (idempotent)

If `<out-dir>` does not exist, copy `<skill-root>/blueprint/` into it verbatim (including dotfiles — `cp -R blueprint/. <out-dir>/` or copy `.gitignore` and `.env.template` explicitly; a plain `cp -R blueprint <out-dir>` on macOS skips hidden files). Then copy `<skill-root>/blueprint/migration-scripts/wordpress/scripts/` to `<out-dir>/.storyblok/migration/wordpress/scripts/` and remove `<out-dir>/migration-scripts/` so the target project only contains migration helper scripts in the gitignored runtime directory.

If it already exists, only refresh `<out-dir>/.storyblok/migration/wordpress/scripts/**/*.ts` from `<skill-root>/blueprint/migration-scripts/wordpress/scripts/**/*.ts`. Never overwrite `package.json` or any hand-edited file.

The scaffold's migration-only helper scripts run from `.storyblok/migration/wordpress/scripts/` and are gitignored in the generated project. The skill keeps the source templates in `blueprint/migration-scripts/wordpress/scripts/` only so this repository can track them. Application schema that belongs to the production app lives in `src/schema/**`; generated migration stories, assets, refs, helper metadata, and runtime scripts stay in the migration workspace.

### 2. Install dependencies

Run `pnpm install` in `<out-dir>`. If `.env` does not exist, copy `.env.template` to `.env`.

Then check whether `STORYBLOK_TOKEN`, `STORYBLOK_PREVIEW_TOKEN`, `STORYBLOK_PUBLIC_TOKEN`, and `STORYBLOK_SPACE_ID` are populated (in `.env` or the shell). These are values the agent cannot obtain on its own — `STORYBLOK_TOKEN` is the Management API (MAPI) personal access token, `STORYBLOK_PREVIEW_TOKEN` and `STORYBLOK_PUBLIC_TOKEN` are Content API (CAPI) tokens for draft and published content respectively, and `STORYBLOK_SPACE_ID` is the numeric target space ID. If any are missing, stop and ask the user for them, then write them to `.env` yourself. Do not proceed until all are set.

### 3. Refresh the CLI build (monoblok only)

If the migration project lives inside the `monoblok` monorepo (i.e. you can run `pnpm nx build storyblok` from the repo root), run this before generation:

In this mode, never read, inspect, or open files in `packages/migrations/playground/wordpress-astro/wordpress/scripts/`. Do not use those files as references. Use the JSON dump, the skill's own `wp-export/` files, and the generated migration project as the working surface.

```
pnpm nx build storyblok
```

Run it from the monorepo root, not from `<out-dir>`. This uses Nx `dependsOn` to rebuild the CLI and its workspace dependencies (`@storyblok/schema`, `@storyblok/migrations`, `@storyblok/richtext`, etc.) so generated output always matches current source.

Then run all migration commands through the blueprint's `pnpm` scripts from `<out-dir>` (`pnpm wp:all`, `pnpm migrate`, etc.). Do not invoke a bare global `storyblok` command from another shell location. The blueprint declares `storyblok: "workspace:*"`, and pnpm scripts resolve `storyblok` from `<out-dir>/node_modules/.bin` before the global `PATH`, so the workspace-built CLI is used.

If there is any doubt, verify from `<out-dir>`:

```
pnpm exec which storyblok
```

The resolved path must point into `<out-dir>/node_modules/.bin/storyblok`, not a global install.

If `<out-dir>` is outside `monoblok` (standalone consumer project), skip this step.

### 4. Generate the local migration artifacts

Run `pnpm wp:all` in `<out-dir>`. This is the discover → generate → build pipeline; it produces app schema in `src/schema/**`, temporary migration TS in `.storyblok/migration/wordpress/generated/**`, and CLI seed JSON/binaries in `.storyblok/{components,stories,assets,datasources}/wordpress/`. It needs no user input and is safe to re-run — the registry keeps IDs stable.

If it fails, diagnose from the output: most failures are either (a) a missing/malformed JSON file in `<dump-dir>/json/`, (b) a stale dependency build (rebuild `@storyblok/richtext` and retry), or (c) a TypeScript error in generated code (read the failing file and fix the generator, don't hand-edit the generated file).

After `wp:build` finishes, verify `.storyblok/assets/wordpress/` contains a binary file next to each generated asset JSON sidecar. If it contains only `.json` files, the dump is missing uploads; restore `<dump-dir>/uploads` and rerun `pnpm wp:build` before `pnpm seed:assets`.

### 5. Push to Storyblok

For the first migration, or after any failed partial migration, run `pnpm seed:cleanup && pnpm migrate` — this purges the target space and does the full push chain (`schema:push && seed:datasources && seed:assets && seed:stories`).

For subsequent migrations after dump changes, run `pnpm migrate` alone. The CLI's `manifest.jsonl` keeps local→remote IDs stable, so stories update in place rather than duplicate.

**Before running either, confirm the target space with the user** — `seed:cleanup` is destructive. Read `STORYBLOK_SPACE_ID` from `.env`, state it back plainly ("I'm about to purge and re-seed space 1234567 — continue?"), and wait for confirmation. This is the one confirmation gate the skill must honor.

### Reference: every script the scaffold exposes

```
pnpm wp:discover      # WP JSON → src/schema/**.ts (data-driven schema)
pnpm wp:generate      # WP JSON + uploads → .storyblok/migration/wordpress/generated/**.ts
pnpm wp:build         # imports src/** and copies asset binaries → writes .storyblok/{components,stories,assets,datasources}/wordpress/
pnpm wp:all           # wp:discover && wp:generate && wp:build
pnpm schema:push      # storyblok schema push src/schema/schema.ts
pnpm seed:cleanup     # purge target space (paginated; safe to re-run)
pnpm seed:datasources # storyblok datasources push --from wordpress
pnpm seed:assets      # storyblok assets push --from wordpress
pnpm seed:stories     # storyblok stories push --from wordpress --publish
pnpm migrate          # full chain: wp:all && schema:push && seed:datasources && seed:assets && seed:stories
```

The sub-scripts exist for when a single step fails and the agent needs to re-run just that one (e.g. `pnpm seed:assets` on its own after fixing an upload error). Keep the command chain serialized with `&&` and always await script work; do not start background cleanup, generation, asset upload, or story push tasks that a later step could race.

### Ensuring the WordPress installation produces JSON dumps

If the WordPress installation does not already produce the JSON dump shape described above, set it up to do so. Use the bundled `<skill-root>/wp-export/export-json.php` exporter — see Branches A and B for how to run it depending on the environment. The goal is that the dump pipeline writes both `<dump-dir>/json/` and `<dump-dir>/uploads/` in the expected layout. How exactly the exporter is wired into the installation's existing dump workflow (cron job, shell script, manual step) depends on the setup — adapt accordingly.

## Authoring conventions

### Application schema (`src/schema/`)

`pnpm wp:discover` populates `src/schema/` with a data-driven schema inferred from the WordPress dump. Files under `src/schema/components/` and `src/schema/datasources/` are overwritten on each run. After the migration setup is complete, the user takes ownership of `src/schema/` and maintains it as their production Storyblok schema.

### Migration pipeline

`pnpm wp:generate` reads the WordPress dump and produces intermediate TypeScript under `.storyblok/migration/wordpress/generated/`. `pnpm wp:build` imports those modules and writes the CLI-ready JSON and asset binaries. Both steps handle block mapping, parent→folder conversion, and asset cross-references automatically.

Storyblok models nested content as folder stories (`is_folder: true`). The scripts convert WordPress parent-child page hierarchies into folders and startpages, preserving nested URL paths and avoiding slug collisions.

### Build output (consumed by the storyblok CLI)

```
.storyblok/components/wordpress/components.json     # SINGLE aggregated array — REQUIRED by `stories push --from wordpress`
.storyblok/stories/wordpress/<slug>_<uuid>.json     # filename suffix MUST be the UUID (CLI parses it)
.storyblok/assets/wordpress/<basename>_<uuid>.{json,<ext>}  # paired sidecar + binary
.storyblok/datasources/wordpress/datasources.json
.storyblok/.registry.json                           # generator's persistent ID/UUID registry
.storyblok/source-manifest.json                     # generator bookkeeping (NOT the CLI's manifest.jsonl)
```

**Do not** create or delete `.storyblok/{stories,assets}/wordpress/manifest.jsonl`. Those are CLI-owned (the local→remote ID map). Wiping them makes the next push duplicate everything.

## Idempotency contract

Every layer of the skill is designed so re-runs are safe:

| Layer | How it stays idempotent |
|---|---|
| Skill scaffold | Copies `blueprint/` only when `<out-dir>` doesn't exist; otherwise refreshes only regenerable scripts. |
| `dump.sh` patch | `grep -q` guards before any append. |
| `wp:discover` | Wholesale overwrites `src/schema/components/` and `src/schema/datasources/`. |
| `wp:generate` | UUIDs + IDs read from `.storyblok/.registry.json` first; only minted on miss. Same WP entity or generated folder → same identifier forever. Temporary generated TS lives under `.storyblok/migration/wordpress/generated/`, not `src/`. |
| `wp:build` | Wipes `.storyblok/{components,stories,assets,datasources}/wordpress/` at the top, but **leaves CLI-owned `manifest.jsonl` files in place**. |
| `pnpm migrate` rerun | CLI's `manifest.jsonl` provides the local→remote ID map → updates existing stories rather than creating duplicates. |

## What the skill does not do

- Frontend / rendering — out of scope. Render the migrated content yourself with whatever framework.
- WPML / Polylang / language-suffixed fields (`__i18n__<locale>`) — not handled in v1.
- WXR or other non-JSON WP exports — pre-transform first, or run `export-json.php` against a live WP.
- Schema refinement — discovery is heuristic. After the initial `wp:discover`, the user owns `src/schema/` and refines it directly.

## Reference docs

- `wp-export/export-json.php` — bundled WordPress exporter script (lives at `<skill-root>/wp-export/`, not under `references/`). Used in Branches A and B to produce the JSON dump and copy upload binaries.
- `references/cli-cheatsheet.md` — exact `--from` / `manifest.jsonl` / filename semantics. Read this when in doubt about the CLI contract.
- `references/block-mapping-rules.md` — how block mapping works internally (prose folding, class-based promotion, naming). Only needed when debugging unexpected schema output or tuning the mapper for a specific WP installation.
