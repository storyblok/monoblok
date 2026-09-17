# Testing Patterns

- Stack: Vitest + memfs (filesystem) + msw (API). Tests co-located as `*.test.ts`.
- Place tests alongside source files (e.g., `program.ts` -> `program.test.ts`).
- For unit tests, use the `qa-engineer-unit` skill.

## API mocking

Start the msw server with `onUnhandledRequest: 'error'`. Without it, a request you forgot to mock
silently reaches the network, so the test either passes for the wrong reason or fails somewhere
unrelated:

```typescript
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Session mocking

The most common mock shape — matches the consumer's expectations:

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

CI runs on both macOS and Windows. These are the non-obvious gotchas:

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

`astro dev` daemonizes when it detects an agentic environment: it forks the server, prints the pid,
and the foreground process exits. `start-server-and-test` treats its child exiting as the server
dying and aborts with "server closed unexpectedly", so the Astro suite fails for anyone running it
from a coding agent while passing in CI.

`ASTRO_DEV_BACKGROUND` suppresses that auto-detection, which is why the e2e target starts the
playground through `playground:test:foreground` rather than `playground:test`. The name reads
backwards: any non-empty value tells Astro the background decision has already been made, so it
skips detection and stays in the foreground.

The same script sets `STORYBLOK_E2E`, which the test playground reads to switch the dev toolbar off.
The toolbar is loaded through a dynamic import that loses the race against Vite re-optimizing
dependencies, and Cypress fails a test on any unhandled rejection. Manual playground runs do not set
it and keep the toolbar.

A daemon that does slip through outlives the run and keeps port 4321, and the next run then binds
4322 and tests against the stale server.
`pnpm --filter @storyblok/playground-astro-test exec astro dev stop` clears it.
