---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
  - "tools/**/*.ts"
---

# Coding Conventions

## Error Handling

Use typed errors with structured IDs (see `packages/cli/src/utils/error/`):
```typescript
// Define error types
export const API_ERRORS = {
  unauthorized: 'The user is not authorized',
  network_error: 'No response from server',
} as const;

// Throw typed errors
throw new APIError('unauthorized', 'login_with_token', fetchError, 'Custom message');
```

## Logging (CLI)

Use the logger with appropriate levels:
```typescript
import { getLogger } from '../../lib/logger';
const logger = getLogger();
logger.info('Operation started');
logger.error('Operation failed', { context });
```

## Testing

### Principles
1. **Behavior-first** - Test what it does, not how it's implemented
2. **Regression tests** - Every bug fix needs a test proving the fix
3. **Minimum set** - Happy path + negative case + 1-2 edge cases
4. **Windows-compatible** - CI runs on Windows too. Use `pathe` (not `node:path`), strip drive letters when comparing with memfs keys, sort directory listings before asserting.

See `docs/testing-patterns.md` for detailed mocking examples (msw, memfs, session).

### Mocking
- Use `msw` for API mocking (not manual mocks)
- Use `memfs` for filesystem mocking
- Co-locate tests with source files
- Test file naming: `*.test.ts`
