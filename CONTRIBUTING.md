# Contributing to Storyblok SDKs

Thank you for your interest in contributing to Storyblok SDKs! This document provides guidelines and instructions for contributing to our monorepo.

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

3. (Optional) Build the monoblok CLI tool:
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

## Pull Request Process

### PR Previews

When you create a pull request, our CI automatically:
1. Builds all packages
2. Generates a preview version (e.g., `0.0.0-pr123-a1b2c3d`)
3. Publishes the packages to GitHub Packages
4. Adds a comment to your PR with installation instructions

To use a preview package:

1. Add the following to your `.npmrc`:
```ini
@storyblok:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

2. Install the preview package:
```bash
npm install @storyblok/package-name@0.0.0-pr123-a1b2c3d
```

The preview version format is: `0.0.0-pr{PR_NUMBER}-{COMMIT_SHA}`

### PR Requirements

1. **Tests**: All changes must include appropriate tests
2. **Documentation**: Update documentation for any new features or changes
3. **TypeScript**: Maintain type safety and add types for new features
4. **Linting**: Ensure your code passes all linting checks
5. **Commit Messages**: Use clear, descriptive commit messages

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

- Update README files when adding new features
- Add JSDoc comments for new functions and classes
- Update type definitions
- Add examples for new features

## Questions?

If you have any questions about contributing, please:
1. Check the [Storyblok Documentation](https://www.storyblok.com/docs)
2. Open an issue in this repository
3. Join our [Discord community](https://storyblok.com/join-discord) 
