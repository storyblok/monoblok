---
name: wordpress-seeder
description: Seed Docker Compose WordPress installations with realistic migration playground content. Use when Codex needs to set up or populate WordPress test fixtures, Gutenberg migration data, the Storyblok WordPress Astro playground at packages/migrations/playground/wordpress-astro/wordpress, or a compatible WordPress stack with a wp-cli service.
---

# WordPress Seeder

Use this skill to start and seed a Docker Compose WordPress installation with reproducible content for migration testing.

The first supported target is the monoblok playground:

```bash
packages/migrations/playground/wordpress-astro/wordpress
```

The scripts can also target another compatible WordPress project if it has:

- `compose.yaml` in the target directory.
- Services named `db`, `wordpress`, and `wp-cli`.
- A `wp-cli` service based on a WordPress CLI image.
- A `.env.template` with the WordPress install values, or an existing `.env`.

## Workflow

Run scripts from the monoblok repo root. If no target path is provided, the scripts default to the WordPress Astro playground.

```bash
bash .claude/skills/wordpress-seeder/scripts/setup.sh
SBP_SCALE=0.01 bash .claude/skills/wordpress-seeder/scripts/seed.sh
bash .claude/skills/wordpress-seeder/scripts/teardown.sh
```

For a custom target, pass the WordPress directory explicitly:

```bash
bash .claude/skills/wordpress-seeder/scripts/setup.sh path/to/wordpress
SBP_SCALE=0.05 bash .claude/skills/wordpress-seeder/scripts/seed.sh path/to/wordpress
bash .claude/skills/wordpress-seeder/scripts/teardown.sh path/to/wordpress
```

## Scripts

- `scripts/setup.sh [target-dir]`: start database and WordPress, create `.env` from `.env.template` if needed, install WordPress core, configure permalinks, and flush rewrite rules.
- `scripts/seed.sh [target-dir]`: run the bundled `seed.php` inside the target's `wp-cli` service.
- `scripts/teardown.sh [target-dir] [--volumes]`: stop the stack. Use `--volumes` only when the user wants to wipe WordPress and database data.

## Seeder controls

Pass these environment variables to `seed.sh`:

- `SBP_SCALE`: multiplier for bulk content counts. Use small values like `0.01` or `0.05` for quick local validation.
- `SBP_FORCE=1`: force a bulk re-seed when count targets already appear satisfied.

The PHP seeder always performs idempotent baseline setup, including media ingestion, nav pages, the home page, header/footer template parts, and templates. Bulk content is bounded by existing counts unless `SBP_FORCE=1` is set.

## Playground notes

The WordPress Astro playground registers the `landing_page` custom post type through:

```bash
packages/migrations/playground/wordpress-astro/wordpress/mu-plugins/storyblok-playground.php
```

Do not recreate that registration in the seeder. The seeder assumes the target stack mounts its `mu-plugins` directory into WordPress.

## Verification

After changing this skill, run:

```bash
python3 /Users/maoberlehner/.codex/skills/.system/skill-creator/scripts/quick_validate.py .claude/skills/wordpress-seeder
bash -n .claude/skills/wordpress-seeder/scripts/setup.sh
bash -n .claude/skills/wordpress-seeder/scripts/seed.sh
bash -n .claude/skills/wordpress-seeder/scripts/teardown.sh
```

For an end-to-end smoke test against the playground, use a small scale:

```bash
bash .claude/skills/wordpress-seeder/scripts/setup.sh
SBP_SCALE=0.01 bash .claude/skills/wordpress-seeder/scripts/seed.sh
```
