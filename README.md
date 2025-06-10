# Monoblok

A monorepo that consolidates all open source projects from the Storyblok organization. This project aims to centralize the development, maintenance, and contribution to Storyblok's ecosystem of SDKs and tools.

## 📦 Available Packages

This monorepo contains all official Storyblok SDKs and integrations:

- `@storyblok/js` - Core JavaScript SDK for Storyblok
- `@storyblok/react` - React SDK and components
- `@storyblok/vue` - Vue.js SDK and components
- `@storyblok/svelte` - Svelte SDK and components
- `@storyblok/nuxt` - Nuxt.js integration
- `@storyblok/astro` - Astro integration
- `@storyblok/richtext` - Rich text renderer
- `@storyblok/js-client` - Storyblok API client (formerly `storyblok-js-client`)

> **Note**: The `storyblok-js-client` package has been renamed to `@storyblok/js-client` and is now part of our scoped packages.

## 🎯 Purpose

This monorepo represents a transition from a polyrepo ecosystem to a monorepo approach for Storyblok's open source projects. The benefits include:

- **Unified development workflow**: Standardized development practices across all projects
- **Simplified dependency management**: Easier management of inter-package dependencies
- **Coordinated releases**: Ability to release multiple packages in tandem
- **Centralized contribution**: Single location for contributors to engage with all Storyblok projects
- **Shared infrastructure**: Common CI/CD, testing frameworks, and development tools

The subtree tooling exists specifically to facilitate the migration from individual repositories to this unified structure, while maintaining the history and ability to sync with the original repositories during the transition period.

## 🛠 Development

### Prerequisites

- Git
- Node.js
- pnpm

### Setup

1. Clone this repository
2. Install dependencies:

```bash
pnpm install
```

3. Build the monoblok CLI tool:

```bash
pnpm build:tools
```

### Development Commands

```bash
# Build all packages
pnpm nx run-many --target=build --all

# Build a specific package
pnpm nx build @storyblok/react

# Run tests
pnpm nx run-many --target=test --all

# Run linting
pnpm nx run-many --target=lint --all

# Run type checking
pnpm nx run-many --target=type-check --all
```

## 🔧 Monoblok CLI

The monorepo comes with a CLI tool to manage subtrees during the migration process:

```bash
# Add all packages from the manifest
pnpm monoblok add

# Add a specific package (supports partial matches)
pnpm monoblok add storyblok-js

# Pull updates for all packages
pnpm monoblok pull

# Pull updates for a specific package
pnpm monoblok pull storyblok-js

# Rebuild a package (remove and re-add)
pnpm monoblok rebuild storyblok-js

# Show help
pnpm monoblok --help
```

## 📄 Manifest File

The `repo-manifest.json` file defines all Storyblok open source projects to be migrated to the monorepo:

```json
{
  "storyblok-js-client": {
    "repo": "storyblok/storyblok-js-client",
    "branch": "main",
    "path": "packages/storyblok-js-client"
  }
  // ...
}
```

To migrate a Storyblok project, add it to the manifest and run `pnpm monoblok add <package-name>`.

## Releasing

Releases are managed using the Nx release workflow. Version numbers can be determined automatically based on conventional commits, or you can specify a version explicitly when running the release command.

To create a release:

1. Run the Nx release command with the `--skip-publish` flag to prepare the release and generate the necessary version commit and tags. By default, the version will be determined from your commit messages (conventional commits).

```bash
# Automatic versioning (conventional commits)
pnpm nx release --skip-publish

# Explicit versioning
pnpm nx release 1.2.3 --skip-publish
```

The versioning step will automatically push the commit and tags to the repository alongwith generating the github release with the changelog.

2. Once the commit and tags are pushed, the publish workflow will be triggered and complete the release process, publishing the packages as needed.

**Note:** Releasing is only permitted for repository users with permissions to push version tags. If you do not have the required permissions, please contact a repository maintainer.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Storyblok Documentation](https://www.storyblok.com/docs)
- [Storyblok Website](https://www.storyblok.com)
- [Storyblok Status](https://status.storyblok.com)
