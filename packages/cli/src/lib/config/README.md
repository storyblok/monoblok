# Storyblok CLI Config Guide

The Storyblok CLI can read defaults from config files so you don't have to repeat the same flags every time you run a command. This guide explains where to store those files, how precedence works, and how to reference environment variables for secrets or per-machine tweaks.

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

3. Run any command, and the CLI will automatically use your config:

```bash
storyblok components pull
```

**Key points:**
- Top-level keys (`region`, `verbose`, `api`, `log`, `report`) are **global** and affect every command.
- Everything inside `modules` mirrors the CLI structure (`components`, `datasources`, `migrations`, `types`, …).
- Nested objects trickle down the command chain, so `modules.components.pull.filename` maps to `storyblok components pull --filename`.

## Config File Locations & Layering

The CLI uses a **layered configuration system** that merges multiple config files, with more specific locations overriding more general ones.

### Config Layers (in order of precedence)

When you run a command, the CLI looks for config files in these locations:

```
Layer 1 (Base):    ~/.storyblok/config.{ext}
Layer 2 (Project): <workspace>/.storyblok/config.{ext}
Layer 3 (Root):    <workspace>/storyblok.config.{ext}
```

**Supported formats:** `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.json`, `.json5`, `.jsonc`, `.yaml`, `.yml`, `.toml`

### How Layering Works

Each layer **merges** with the previous ones:

1. **Layer 1 - Home directory** (`~/.storyblok/config.*`): Personal defaults that apply to all projects on your machine. Great for storing your region, tokens, or personal preferences.

2. **Layer 2 - Workspace hidden folder** (`.storyblok/config.*`): Project-wide defaults shared with your team, but kept out of sight in a hidden directory.

3. **Layer 3 - Project root** (`storyblok.config.*`): The main config that lives next to `package.json`. This is usually where you define project-specific settings.

**Example:** If you have:
- `~/.storyblok/config.ts` with `{ region: 'us' }`
- `storyblok.config.ts` with `{ verbose: true }`

The final config will be: `{ region: 'us', verbose: true }`

### Precedence Rules

Values from higher layers override lower layers:

```
CLI Flags > Project Root > Workspace Hidden > Home Directory > Built-in Defaults
```

This means you can:
- Set defaults in your home directory
- Override them in your project config
- Override everything with CLI flags when needed

If no config files exist, the CLI uses its built-in defaults and notifies you when running with `--verbose`.

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

**Tips:**
- Store secrets (tokens, IDs) in `~/.storyblok/config.*` or environment variables instead of the repository.
- You can still override any value per run with CLI flags (e.g., `storyblok components pull --region "au"`).

## Complete Config Example

Here's a complete config file showing all available global options with their default values:

```ts
// storyblok.config.ts
import { defineConfig } from 'storyblok/config';

export default defineConfig({
  // General settings
  region: 'eu', // Storyblok region: 'eu', 'us', 'ap', 'ca', 'cn'
  verbose: false, // Enable verbose output

  // API configuration
  api: {
    maxRetries: 3, // Maximum retry attempts for failed requests
    maxConcurrency: 6, // Maximum concurrent API requests
  },

  // Logging configuration
  log: {
    console: {
      enabled: true, // Enable console logging
      level: 'info', // Log level: 'info', 'warn', 'error', 'debug'
    },
    file: {
      enabled: true, // Enable file logging
      level: 'info', // File log level
      maxFiles: 10, // Maximum log files to keep
    },
  },

  // Report configuration
  report: {
    enabled: true, // Enable report generation
    maxFiles: 10, // Maximum report files to keep
  },

  // Module-specific configuration
  modules: {
    components: {
      path: '.storyblok', // Components working directory
      pull: {
        separateFiles: false, // Separate output per component
        filename: 'components', // Filename for exports
      },
      push: {
        dryRun: false, // Preview changes without pushing
      },
    },
    datasources: {
      pull: {
        separateFiles: false,
      },
      push: {
        dryRun: false,
      },
    },
    migrations: {
      space: undefined, // Target space ID
      run: {
        dryRun: false,
      },
    },
    types: {
      generate: {
        output: 'storyblok-component-types.d.ts',
      },
    },
  },
});
```

## Global Options Reference

| Flag | Config File | Description | Default |
|------|-------------|-------------|---------|
| `--verbose` | `verbose` | Enable verbose output | `false` |
| `--region <region>` | `region` | Storyblok region used for API requests | `eu` |
| `--api-max-retries <number>` | `api.maxRetries` | Maximum retry attempts for HTTP requests | `3` |
| `--api-max-concurrency <number>` | `api.maxConcurrency` | Maximum concurrent API requests | `6` |
| `--log-console-enabled` / `--no-log-console-enabled` | `log.console.enabled` | Enable/disable console logging output | `true` |
| `--log-console-level <level>` | `log.console.level` | Console log level | `info` |
| `--log-file-enabled` / `--no-log-file-enabled` | `log.file.enabled` | Enable/disable file logging output | `true` |
| `--log-file-level <level>` | `log.file.level` | File log level | `info` |
| `--log-file-max-files <number>` | `log.file.maxFiles` | Max log files kept on disk | `10` |
| `--report-enabled` / `--no-report-enabled` | `report.enabled` | Enable/disable report generation | `true` |
| `--report-max-files <number>` | `report.maxFiles` | Max report files kept on disk | `10` |

## How Config Resolution Works

The CLI resolves your final configuration through these steps:

1. **Start with built-in defaults** - The CLI has sensible defaults for all options
2. **Apply config layers** - Merge config files from home → workspace → project
3. **Hydrate Commander defaults** - Apply command-specific option defaults
4. **Apply CLI flags** - Explicit flags always win

Run any command with `--verbose` to see which files were loaded and the final config:

```bash
storyblok components pull --verbose
```

Look for `Loaded Storyblok config: ...` and `Active config for "storyblok components pull": { ... }` in the output.

## Troubleshooting & Tips

- **Need to confirm which file was used?** Run with `--verbose` and look for `Loaded Storyblok config: …` lines.
- **Want typed authoring?** Keep using `defineConfig` in `.ts` files; for JSON/YAML you can omit it if you don't need type-safety.
- **Boolean flags:** Options that default to `true` provide **both** positive and negative forms (e.g., `--log-file-enabled` and `--no-log-file-enabled`). This allows you to override config file values in either direction. Options that default to `false` only provide the positive form (e.g., `--verbose`).
- **Nested config paths:** Flags use hyphens to represent nested paths. The CLI dynamically detects whether a segment is part of the path or a property name by checking the config structure. For example:
  - `--log-file-enabled` → `log` is an object, `file` is an object under `log`, so `enabled` becomes the property at `log.file.enabled`
  - `--api-max-retries` → `api` is an object, so `maxRetries` becomes the property at `api.maxRetries`
  - `--log-file-max-files` → `log.file` are objects, `maxFiles` is the property at `log.file.maxFiles`
- **Override examples:**
  - Enable verbose output: `storyblok components pull --verbose`
  - Enable file logging (override config): `storyblok components pull --log-file-enabled`
  - Disable file logging: `storyblok components pull --no-log-file-enabled`
  - Enable reports (override config): `storyblok components pull --report-enabled`
  - Disable reports: `storyblok components pull --no-report-enabled`
  - Change API retries: `storyblok components pull --api-max-retries 10`

With this setup you can standardize how your team runs the Storyblok CLI while still letting individuals apply overrides locally or via environment variables.
