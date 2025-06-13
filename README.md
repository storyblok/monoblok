<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok" align="center">
    <img src="https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png" alt="Storyblok Logo">
  </a>
  <h1 align="center">Monoblok</h1>
  <p align="center">
    A monorepo that consolidates all open source projects from the Storyblok organization. This project aims to centralize the development, maintenance, and contribution to Storyblok's ecosystem of SDKs and tools.
  </p>
</div>

<p align="center">
  <a href="https://discord.gg/jKrbAMz">
    <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=09b3af">
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-09b3af?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-09b3af?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## 📦  Packages

This monorepo contains all official Storyblok SDKs and integrations:

### Core SDKs

| Package                                              | Description                                            | Status                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/js](packages/js)                         | Core JavaScript SDK for Storyblok                      | [![npm](https://img.shields.io/npm/v/@storyblok/js?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/js) [![npm](https://img.shields.io/npm/dm/@storyblok/js?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/js)                                                 |
| [@storyblok/js-client](packages/js-client)           | JavaScript client for Storyblok's Content Delivery API | [![npm](https://img.shields.io/npm/v/@storyblok/js-client?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/js-client) [![npm](https://img.shields.io/npm/dm/@storyblok/js-client?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/js-client)                     |
| [@storyblok/content-client](packages/content-client) | Content client for Storyblok's Content Delivery API    | [![npm](https://img.shields.io/npm/v/@storyblok/content-client?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/content-client) [![npm](https://img.shields.io/npm/dm/@storyblok/content-client?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/content-client) |

### Framework Integrations

| Package                              | Description              | Status                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/react](packages/react)   | React SDK for Storyblok  | [![npm](https://img.shields.io/npm/v/@storyblok/react?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/react) [![npm](https://img.shields.io/npm/dm/@storyblok/react?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/react)     |
| [@storyblok/vue](packages/vue)       | Vue SDK for Storyblok    | [![npm](https://img.shields.io/npm/v/@storyblok/vue?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/vue) [![npm](https://img.shields.io/npm/dm/@storyblok/vue?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/vue)             |
| [@storyblok/nuxt](packages/nuxt)     | Nuxt SDK for Storyblok   | [![npm](https://img.shields.io/npm/v/@storyblok/nuxt?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/nuxt) [![npm](https://img.shields.io/npm/dm/@storyblok/nuxt?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/nuxt)         |
| [@storyblok/svelte](packages/svelte) | Svelte SDK for Storyblok | [![npm](https://img.shields.io/npm/v/@storyblok/svelte?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/svelte) [![npm](https://img.shields.io/npm/dm/@storyblok/svelte?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/svelte) |
| [@storyblok/astro](packages/astro)   | Astro SDK for Storyblok  | [![npm](https://img.shields.io/npm/v/@storyblok/astro?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/astro) [![npm](https://img.shields.io/npm/dm/@storyblok/astro?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/astro)     |

### Utilities

| Package                                  | Description                      | Status                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/richtext](packages/richtext) | Rich Text Renderer for Storyblok | [![npm](https://img.shields.io/npm/v/@storyblok/richtext?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/richtext) [![npm](https://img.shields.io/npm/dm/@storyblok/richtext?color=09b3af&labelColor=black)](https://www.npmjs.com/package/@storyblok/richtext) |

## 🚧 Migration Status

This repository represents an ongoing migration from a polyrepo structure to a unified monorepo. While we're actively working on this transition, please note:

- All new development should be done in this repository
- Existing packages are being migrated gradually
- Some packages may still be in their original repositories during the transition
- We're working to ensure a smooth migration with minimal disruption

## 🛠️ Development

### Prerequisites

- Node.js (v18 or later)
- pnpm (v8 or later)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/storyblok/monoblok.git
   cd monoblok
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Package Management with PNPM

This repository uses PNPM as its primary package manager, providing efficient dependency management and disk space usage. The workspace is configured in `pnpm-workspace.yaml` and includes all packages in the `packages/` directory.

Common PNPM commands:
```bash
# Install dependencies
pnpm install

# Add a dependency to a specific package
pnpm add <package> --filter @storyblok/react

# Run a script in a specific package
pnpm --filter @storyblok/react <script>
```

### Development with NX

While PNPM manages our packages, we use NX to optimize our development workflow. NX provides powerful features for:

- Intelligent caching
- Affected package detection
- Dependency graph visualization
- Parallel task execution
- Project-specific configurations

#### Common NX Commands

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm build @storyblok/react

# Run tests for affected packages
pnpm nx affected:test

# Show dependency graph
pnpm nx graph

# Run commands only on affected packages
pnpm nx affected --target=build
```

#### Development Workflows

```bash
# Start development mode for a package
pnpm dev @storyblok/react

# Run tests in watch mode
pnpm test:watch @storyblok/react

# Lint all packages
pnpm lint

# Format all packages
pnpm format

# Check types
pnpm type-check
```

For more advanced NX usage, we recommend exploring:
- [NX Documentation](https://nx.dev/docs)
- [NX Cache](https://nx.dev/concepts/how-caching-works)
- [NX Affected](https://nx.dev/concepts/affected)
- [NX Project Configuration](https://nx.dev/concepts/project-configuration)

### Repository Administration

For repository administrators, we provide the `monoblock-cli` tool to help manage the monorepo. This tool assists with:

- Package migration
- Dependency management
- Repository maintenance
- Release coordination

See the [monoblock-cli package](packages/monoblock-cli) for detailed documentation and usage instructions.

## 📄 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code style and standards
- Pull request process
- Development workflow
- Testing requirements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Storyblok Documentation](https://www.storyblok.com/docs)
- [Storyblok Website](https://www.storyblok.com)
- [Storyblok Status](https://status.storyblok.com)
- [Storyblok GitHub Organization](https://github.com/storyblok)
