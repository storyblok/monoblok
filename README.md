<div align="center">
  <a href="https://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok" align="center">
    <img src="https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png" alt="Storyblok Logo">
  </a>
  <h1 align="center">Monoblok</h1>
  <p align="center">
    A monorepo that consolidates all JavaScript projects from the Storyblok organization. This project aims to centralize the development, maintenance, and contribution to Storyblok's ecosystem of SDKs and tools.
  </p>
</div>

<p align="center">
  <a href="https://storyblok.com/join-discord">
    <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=monoblok">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## 📦 Packages

This monorepo contains the following official Storyblok SDKs and integrations:

### Core SDKs

| Package                                            | Description                                                       | Version                                                                                                                                     | Downloads                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/js](packages/js)                       | Core JavaScript SDK for Storyblok                                 | [![](https://img.shields.io/npm/v/@storyblok/js?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/js)                       | [![](https://img.shields.io/npm/dm/@storyblok/js?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/js)                       |
| [storyblok-js-client](packages/js-client)          | JavaScript client for Storyblok's Content Delivery API            | [![](https://img.shields.io/npm/v/storyblok-js-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok-js-client)           | [![](https://img.shields.io/npm/dm/storyblok-js-client?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok-js-client)           |
| [storyblok-cli](packages/cli)                      | A powerful CLI tool to improve the DX of your Storyblok projects. | [![](https://img.shields.io/npm/v/storyblok?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok)                               | [![](https://img.shields.io/npm/dm/storyblok?color=8d60ff&label=%20)](https://www.npmjs.com/package/storyblok)                               |
| [@storyblok/region-helper](packages/region-helper) | A helper package to handle Storyblok APIs in different regions.   | [![](https://img.shields.io/npm/v/@storyblok/region-helper?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/region-helper) | [![](https://img.shields.io/npm/dm/@storyblok/region-helper?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/region-helper) |

### Framework Integrations

| Package                              | Description              | Version                                                                                                                       | Downloads                                                                                                                      |
| ------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [@storyblok/react](packages/react)   | React SDK for Storyblok  | [![](https://img.shields.io/npm/v/@storyblok/react?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/react)   | [![](https://img.shields.io/npm/dm/@storyblok/react?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/react)   |
| [@storyblok/vue](packages/vue)       | Vue SDK for Storyblok    | [![](https://img.shields.io/npm/v/@storyblok/vue?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/vue)       | [![](https://img.shields.io/npm/dm/@storyblok/vue?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/vue)       |
| [@storyblok/nuxt](packages/nuxt)     | Nuxt SDK for Storyblok   | [![](https://img.shields.io/npm/v/@storyblok/nuxt?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/nuxt)     | [![](https://img.shields.io/npm/dm/@storyblok/nuxt?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/nuxt)     |
| [@storyblok/svelte](packages/svelte) | Svelte SDK for Storyblok | [![](https://img.shields.io/npm/v/@storyblok/svelte?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/svelte) | [![](https://img.shields.io/npm/dm/@storyblok/svelte?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/svelte) |
| [@storyblok/astro](packages/astro)   | Astro SDK for Storyblok  | [![](https://img.shields.io/npm/v/@storyblok/astro?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/astro)   | [![](https://img.shields.io/npm/dm/@storyblok/astro?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/astro)   |

### Utilities

| Package                                  | Description                      | Version                                                                                                                           | Downloads                                                                                                                          |
| ---------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [@storyblok/richtext](packages/richtext) | Rich Text Renderer for Storyblok | [![](https://img.shields.io/npm/v/@storyblok/richtext?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/richtext) | [![](https://img.shields.io/npm/dm/@storyblok/richtext?color=8d60ff&label=%20)](https://www.npmjs.com/package/@storyblok/richtext) |

## 🚧 Migration Status

This repository represents an ongoing migration from a polyrepo structure to a unified monorepo. While we're actively working on this transition, please note:

- All new development should be done in this repository
- Existing packages are being migrated gradually
- Some packages may still be in their original repositories during the transition
- We're working to ensure a smooth migration with minimal disruption

## 🛠️ Development

### Prerequisites

- Node.js (v18 or later)
- pnpm (v10 or later)
- Git
- [Vite+](https://viteplus.dev/guide/) (`vp` CLI) — pin the version listed in `.viteplus-version`

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

### Package management

This repository uses pnpm workspaces (configured in the root `package.json`) for dependency management.

```bash
# Install dependencies
pnpm install

# Add a dependency to a specific package
pnpm add <package> --filter @storyblok/react

# Run a script in a specific package
pnpm --filter @storyblok/react <script>
```

### Tooling

Packages share a unified toolchain via [Vite+](https://viteplus.dev) (`vp` CLI):

- `vp pack` / `vp build` for bundling (tsdown / Vite under the hood)
- `vp test` for testing (Vitest)
- `vp lint` for linting (Oxlint via `@storyblok/lint-config`)
- `vp fmt` for formatting (Oxfmt)

Framework-specific builders (Angular CLI, Nuxt module builder, svelte-package, Redocly) are kept where Vite+ doesn't apply.

Every package exposes the same canonical script names. See [`AGENTS.md`](./AGENTS.md) for the full table.

### Common commands

NX orchestrates tasks across the monorepo with caching and affected-only execution:

```bash
# Build all packages
pnpm nx run-many --target=build

# Build a specific package
pnpm nx build @storyblok/react

# Run all tests (or affected only)
pnpm test
pnpm nx affected --target=test

# Lint, format, type-check the whole repo
pnpm lint
pnpm format
pnpm test:types

# Watch-build a single package while developing
pnpm --filter @storyblok/react dev

# Re-run a package's tests on change
pnpm --filter @storyblok/migrations test:watch

# Show the dependency graph
pnpm nx graph
```

For more advanced NX usage:

- [NX Documentation](https://nx.dev/docs)
- [NX Cache](https://nx.dev/concepts/how-caching-works)
- [NX Affected](https://nx.dev/concepts/affected)
- [NX Project Configuration](https://nx.dev/concepts/project-configuration)

### Repository administration

For repository administrators, the internal `monoblok` CLI helps manage the monorepo (license checks, migration helpers, etc.). See [`tools/monoblok`](tools/monoblok) for details.

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
