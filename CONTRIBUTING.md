# Contributing to Storyblok SDKs

Thank you for your interest in contributing to Storyblok SDKs! This document provides guidelines and
instructions for contributing to our monorepo.

## Development Workflow

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Development Setup

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

3. (Optional) Rebuild the internal monoblok CLI tool. It is built on `pnpm install` automatically;
   rebuild manually only when changing it:

```bash
pnpm --filter monoblok-cli build
```

### Development Commands

```bash
# Build all packages (the blueprints are left out, CI builds the affected ones)
pnpm build

# Build a specific package
pnpm nx build @storyblok/react

# Run all tests
pnpm test

# Type-check every TypeScript package
pnpm test:types

# Lint everything (root + all packages)
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Format with Oxfmt
pnpm format

# Watch-build a single package while developing
pnpm --filter @storyblok/react dev

# Re-run a package's tests on change
pnpm --filter @storyblok/migrations test:watch
```

## Pull Request Process

### PR Previews

Every push to a branch in this repository other than `main` publishes preview builds of all public
packages through [pkg.pr.new](https://pkg.pr.new). The pkg.pr.new bot posts the install commands on
the pull request.

### PR Requirements

1. **Tests**: All changes must include appropriate tests
2. **Documentation**: Update documentation for any new features or changes
3. **TypeScript**: Maintain type safety and add types for new features
4. **Linting**: Ensure your code passes all linting checks
5. **Commit Messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) with a
   mandatory scope: a package folder name under `packages/` (for example `feat(cli): …`) or one of
   `release`, `repo`, `deps`, `ci`, `docs`, `tools`, or `agents`. Commitlint checks commits and PR
   titles. `fix` and `feat` release the package, so use them only for changes its consumers can
   observe; use `chore` for tests, playgrounds, tooling, CI, and repository docs.

### Review Process

1. All PRs require at least one review
2. CI checks must pass
3. PRs should be up to date with the main branch
4. Any conflicts should be resolved

## Code Style

- Follow the existing code style in each package
- Use TypeScript for all new code
- Follow the linting rules defined in each package
- Write clear, self-documenting code

## Testing

- Write unit tests for all new features
- Ensure existing tests pass
- Add integration tests for complex features
- Test across different environments when relevant

## Documentation

- Draft user-facing docs in a `DOCS.md` (see [`docs/docs-platform.md`](docs/docs-platform.md)); the
  docs live on the Storyblok docs site, and package READMEs stay minimal
- Add JSDoc comments for new functions and classes
- Update type definitions
- Add examples for new features

## Questions?

If you have any questions about contributing, please:

1. Check the [Storyblok Documentation](https://www.storyblok.com/docs)
2. Open an issue in this repository
3. Join our [Discord community](https://storyblok.com/join-discord)
