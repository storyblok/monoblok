# Components Command

The `components` module provides tools to manage Storyblok components and their dependencies.

## Subcommands

- [`pull`](./pull/README.md): Download components from your Storyblok space.
- [`push`](./push/README.md): Upload components and their dependencies (groups, tags, presets, whitelists) to your Storyblok space.
- `delete` (coming soon): Remove components from your Storyblok space.

> See each subcommand for detailed usage, options, and examples.

## Selective sync

Both `pull` and `push` support `--filter`, `--group`, and `--tag` to sync a subset of a space's components instead of all of them. Each selected component is synced together with its dependencies (assigned groups, tags, presets, and schema-whitelisted groups and tags). See the [pull selective pull section](./pull/README.md#selective-pull) and the [push selective push section](./push/README.md#selective-push) for the full semantics and examples.
