# Testing Patterns

- Stack: Vitest, msw for HTTP, memfs for the filesystem.
- Co-locate tests with the source as `*.test.ts` (`program.ts` → `program.test.ts`).
- Test behavior, not implementation. Every behavior change needs integration coverage of the command
  or public entry point, written before the implementation. Unit tests supplement it; see the
  `qa-engineer-unit` skill.
- Every bug fix needs a regression test.
- Minimum set: happy path, a negative case, and 1-2 edge cases.
- Titles start with `should` and describe behavior, not the function called:
  `it('should pull stories into the local workspace')`.

## API mocking

Start the msw server with `onUnhandledRequest: 'error'`. Without it, a request you forgot to mock
silently reaches the network, so the test either passes for the wrong reason or fails somewhere
unrelated:

```typescript
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Session mocking (CLI)

The most common shape for CLI command tests:

```typescript
vi.mock("../../session", () => ({
  session: () => ({
    state: { isLoggedIn: true, password: "test-token", region: "eu", login: "test@example.com" },
    initializeSession: vi.fn(),
    updateSession: vi.fn(),
    persistCredentials: vi.fn(),
  }),
}));
```

## Windows compatibility

CI runs every package on Linux and the CLI additionally on Windows. Non-obvious gotchas:

- **Use `pathe`**, not `node:path` — avoids backslash paths and drive-letter prefixes on Windows
- **memfs strips drive letters** — strip with `p.replace(/^[a-z]:/i, '')` before comparing against
  `vol.toJSON()` keys
- **Sort directory listings** before asserting — `readdir` order varies across OS
- **Mock `pathToFileURL`** to pass through — prevents Windows drive-letter prefix breaking `vi.mock`
  interception:
  ```typescript
  vi.mock("node:url", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:url")>();
    return { ...actual, pathToFileURL: (p: string) => ({ href: p }) };
  });
  ```

## Astro end-to-end tests

`playground:test:foreground` starts the playground with two env vars:

- **`ASTRO_DEV_BACKGROUND`** stops `astro dev` from daemonizing in agentic environments, which makes
  `start-server-and-test` abort with "server closed unexpectedly". A daemon that slips through keeps
  port 4321 and the next run tests against it; clear it with
  `pnpm --filter @storyblok/playground-astro-test exec astro dev stop`.
- **`STORYBLOK_E2E`** turns off the dev toolbar; see `playground/test/astro.config.mjs`.
