# Guidelines for Monoblok CLI

This document provides instructions for AI agents operating in the `packages/cli` directory of the `monoblok` repository.

## Environment & commands

- **Project Structure:**
  - This is a monorepo workspace.
  - CLI source code is in `src/`.
  - Distributable output goes to `dist/`.

### Important commands

| Action         | Command           | Notes                         |
| :------------- | :---------------- | :---------------------------- |
| **Lint Fix**   | `pnpm lint:fix`   | Auto-fixes linting issues.    |
| **Type Check** | `pnpm test:types` | Checks types.                 |
| **Test (CI)**  | `pnpm test:ci`    | Runs tests in non-watch mode. |

## Code style & conventions

### Naming

- **Files:** kebab-case (e.g., `custom-fields-parser.ts`).
- **Classes:** PascalCase.
- **Functions/Variables:** camelCase.
- **Interfaces/Types:** PascalCase.

### Automated tests with vitest

- Place tests alongside source files (e.g., `program.ts` -> `program.test.ts`).
- Rely on the `qa-engineer-integration` or `qa-engineer-unit` skills for further testing instructions.

### Manual tests

- Use the `qa-engineer-manual` skill when it comes to testing the DX of a feature and validating end-to-end functionality.

## Development workflow

- **Step 1:** Create/Modify Test (see `qa-engineer-integration` or `qa-engineer-unit` skills).
- **Step 2:** Verify Test Fails (`pnpm test:ci <filename>`).
- **Step 3:** Write Implementation.
- **Step 4:** Verify Test Passes (`pnpm test:ci <filename>`).
- **Step 5:** Run Fix & Check (`pnpm test:types && pnpm lint:fix`) before finishing.
