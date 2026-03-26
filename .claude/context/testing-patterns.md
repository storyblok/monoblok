# Testing Patterns

**Stack:** Vitest + memfs (filesystem) + msw (API). Tests co-located as `*.test.ts`.

## Session mocking

The most common mock shape — matches the consumer's expectations:

```typescript
vi.mock('../../session', () => ({
  session: () => ({
    state: { isLoggedIn: true, password: 'test-token', region: 'eu', login: 'test@example.com' },
    initializeSession: vi.fn(),
    updateSession: vi.fn(),
    persistCredentials: vi.fn(),
  }),
}));
```

## Windows compatibility

CI runs on both macOS and Windows. These are the non-obvious gotchas:

- **Use `pathe`**, not `node:path` — avoids backslash paths and drive-letter prefixes on Windows
- **memfs strips drive letters** — strip with `p.replace(/^[a-z]:/i, '')` before comparing against `vol.toJSON()` keys
- **Sort directory listings** before asserting — `readdir` order varies across OS
- **Mock `pathToFileURL`** to pass through — prevents Windows drive-letter prefix breaking `vi.mock` interception:
  ```typescript
  vi.mock('node:url', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:url')>();
    return { ...actual, pathToFileURL: (p: string) => ({ href: p }) };
  });
  ```
