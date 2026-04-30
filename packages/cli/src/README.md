![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

# Storyblok CLI

## Installation

For the latest version, install the package using the following command:

```bash
npm install storyblok
```

Or for a specific version:

```bash
npm install storyblok@<version>
```

## API

| Command                                                           | Status | Notes                                                                                                                               |
| ----------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`login`](./commands/login/README.md)                             | ✅     | Improved DX and credentials storage in ~/.storyblok/credentials.json                                                                |
| [`logout`](./commands/logout/README.md)                           | ✅     |                                                                                                                                     |
| [`user`](./commands/user/README.md)                               | ✅     |                                                                                                                                     |
| [`languages pull`](./commands/languages/README.md)                | ✅     | Replaces previous pull-languages                                                                                                    |
| [`components pull`](./commands/components/pull/README.md)         | ✅     | Replaces previous pull-components                                                                                                   |
| [`components push`](./commands/components/push/README.md)         | ✅     | Replaces previous push-components. Also handles dependencies such as groups, tags, presets and whitelists. (Datasources is pending) |
| `components delete`                                               | 📝     | Will replace delete-component and delete-components                                                                                 |
| [`assets pull`](./commands/assets/pull/README.md)                 | ✅     | Download assets and asset folders from your Storyblok space. Supports private assets with `--asset-token` option.                   |
| [`assets push`](./commands/assets/push/README.md)                 | ✅     | Upload assets and asset folders to your Storyblok space                                                                             |
| [`stories pull`](./commands/stories/pull/README.md)               | ✅     | Download stories from your Storyblok space                                                                                          |
| [`stories push`](./commands/stories/push/README.md)               | ✅     | Upload stories to your Storyblok space                                                                                              |
| [`migrations generate`](./commands/migrations/generate/README.md) | ✅     | Replaces previous generate-migrations                                                                                               |
| [`migrations run`](./commands/migrations/run/README.md)           | ✅     | Replaces previous run-migrations                                                                                                    |
| [`migrations rollback`](./commands/migrations/rollback/README.md) | ✅     | Replaces previous rollback-migrations                                                                                               |
| [`types generate`](./commands/types/generate/README.md)           | ✅     | Replaces previous generate-typescript-typedefs                                                                                      |
| [`signup`](./commands/signup/README.md)                           | ✅     | Opens the Storyblok signup page in your browser                                                                                     |
| `sync`                                                            | ⚠️     | Pending new API endpoint implementation for improved performance and reliability (Check below for more details)                     |
| [`create`](./commands/create/README.md)                           | ✅     | Scaffold a new project using Storyblok                                                                                              |
| `datasources pull`                                                | 📝     |                                                                                                                                     |
| `datasources push`                                                | 📝     |                                                                                                                                     |
| `datasources delete`                                              | 📝     | Will replace delete-datasources                                                                                                     |
| `select`                                                          | 💬     | To be discussed                                                                                                                     |
| `quickstart`                                                      | 💬     | To be discussed                                                                                                                     |
| `spaces`                                                          | 💬     | To be discussed                                                                                                                     |
| `import`                                                          | 💬     | To be discussed                                                                                                                     |

### Status Legend

- ✅ Ready: Feature is implemented and ready to use
- 📝 Planned: Feature is planned for future implementation
- ⚠️ v3: Feature is available only in [v3](https://github.com/storyblok/storyblok-cli/tree/v3)
- 💬 TBD: Feature is under discussion

## Sync Command

> [!IMPORTANT]
> The sync command is being reimagined as a new API endpoint that will perform synchronization between spaces. This new implementation, compared to the current version, will provide:
>
> - Faster synchronization
> - Improved reliability by running on our backend servers
> - Better handling of large-scale synchronization operations

If you wish to continue using the `sync` command, please refer to the [v3](https://github.com/storyblok/storyblok-cli/tree/v3?tab=readme-ov-file#sync) documentation and use `storyblok@v3.36.1` or previous.

## Global Options

These options are available for all commands:

| Option          | Description                         | Default |
| --------------- | ----------------------------------- | ------- |
| `-v, --verbose` | Enable verbose output for debugging | `false` |
| `--ci`          | Enable CI mode (coming soon)        | `false` |

> [!TIP]
> When reporting a bug or opening a support ticket, please run the command with the `--verbose` flag and add the output to it. This will help us better understand and resolve the issue.
