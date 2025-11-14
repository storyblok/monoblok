# Storyblok CLI Config Guide

The Storyblok CLI can read defaults from config files so you don’t have to repeat the same flags every time you run a command. This guide explains where to store those files, how precedence works, and how to reference environment variables for secrets or per-machine tweaks.

## Where the CLI Looks for Config

Whenever you run a command, the CLI checks the following locations (most general first):

```
1. ~/.storyblok/config.{js,ts,mjs,cjs,json,yaml,yml}
2. <workspace>/.storyblok/config.{ext}
3. <workspace>/storyblok.config.{ext}
```

- **Home directory (`~/.storyblok`)** — great for personal defaults (region, tokens) that you don’t want inside a repo.
- **Workspace hidden folder (`.storyblok/config.*`)** — shared defaults for a project without exposing them at the repo root.
- **Project root (`storyblok.config.*`)** — the config that usually lives next to `package.json`.

Later files override earlier ones. If none exist, the CLI falls back to its baked-in defaults and lets you know when running with `--verbose`.

## Quick Start

1. Create a `storyblok.config.ts` (or `.js`, `.json`, `.yaml`, …) in your project root.
2. Export a config object with the helper provided by the CLI:

```ts
// storyblok.config.ts
import { defineConfig } from 'storyblok/config';

export default defineConfig({
  region: 'us',
  verbose: true,
  modules: {
    components: {
      path: '.storyblok/components', // module-level config - applies to all components commands
      pull: {
        separateFiles: true,
        suffix: 'dev',
      },
    },
    migrations: {
      space: '12345',
    },
  },
});
```

- Top-level keys (`region`, `verbose`, `api`, `log`, `report`) are **global** and affect every command.
- Everything inside `modules` mirrors the CLI structure (`components`, `datasources`, `migrations`, `types`, …). Nested objects trickle down the command chain, so `modules.components.pull.filename` maps to `storyblok components pull --filename`.

## Using Environment Variables

Config files run inside Node, so you can read environment variables directly. The CLI already loads `.env` files via `dotenv/config`, meaning `process.env.*` is available.

```ts
import { defineConfig } from 'storyblok/config';

const spaceId = process.env.STORYBLOK_SPACE_ID ?? '12345';
const verbose = process.env.STORYBLOK_VERBOSE ?? '';

export default defineConfig({
  region: process.env.STORYBLOK_REGION ?? 'eu',
  verbose: verbose ? verbose !== 'false' : false,
  api: {
    maxRetries: Number(process.env.STORYBLOK_MAX_RETRIES ?? 5),
  },
  modules: {
    migrations: {
      space: spaceId,
    },
  },
});
```

Tips:
- Store secrets (tokens, IDs) in `~/.storyblok/config.*` or environment variables instead of the repository.
- You can still override any value per run with CLI flags (e.g., `storyblok components pull --region "au"`).

## Global Option Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--verbose [boolean]` | Enable verbose output | `false` |
| `--region <region>` | Storyblok region used for API requests | `eu` |
| `--api.max-retries <number>` | Maximum retry attempts for HTTP requests | `3` |
| `--api.max-concurrency <number>` | Maximum concurrent API requests | `6` |
| `--log.console.enabled [boolean]` | Turn console logging on/off | `true` |
| `--log.console.level <level>` | Console log level | `info` |
| `--log.file.enabled [boolean]` | Turn file logging on/off | `true` |
| `--log.file.level <level>` | File log level | `info` |
| `--log.file.max-files <number>` | Max log files kept on disk | `10` |
| `--report.enabled [boolean]` | Enable report generation | `true` |
| `--report.max-files <number>` | Max report files kept on disk | `10` |

## How Overrides Work

1. Start with the CLI’s built-in defaults.
2. Apply config files in the order listed above (home → workspace → project).
3. Hydrate command-specific defaults from the Commander option definitions.
4. Apply explicit CLI flags last — they always win.

Run any command with `--verbose` to see which files were loaded and the final config snapshot, e.g.:

```
storyblok components pull --verbose
```

Look for `Active config for "storyblok components pull": { ... }` in the output.

## Troubleshooting & Tips

- **Need to confirm which file was used?** Run with `--verbose` and look for `Loaded Storyblok config: …` lines.
- **Want typed authoring?** Keep using `defineConfig` in `.ts` files; for JSON/YAML you can omit it if you don’t need type-safety.

With this setup you can standardize how your team runs the Storyblok CLI while still letting individuals apply overrides locally or via environment variables.
