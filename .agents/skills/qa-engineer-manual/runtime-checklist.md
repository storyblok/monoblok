# Runtime and lifetime checks

**Gate:** you are assigned a feature, library, or app to test. Ask three questions about it:

- Does it remember anything from one call to the next: a session, an assignment, a cache, a counter?
- Does it keep working after it has answered: sending, writing, queueing, anything the caller does not wait for?
- Is it meant to run in more than one place: server and browser, serverless, edge?

One yes and this checklist is part of your test plan. Three noes, skip it. Skip also: pure functions, type-only changes, codegen output, single-caller internal tools, and refactors with no signature change.

**The failure mode is silence.** These defects return cleanly and do nothing. Looking for exceptions will not find them, so every box below asserts an outcome, not the absence of an error.

## 1. Prototype it, from the docs only

One minimal app per applicable runtime. The smallest thing that exercises the documented happy path end to end.

- [ ] **Node, long-lived.** The forgiving baseline. Passing here proves little.
- [ ] **Serverless.** Simulate the runtime locally, one cold instance per request. Two details carry the whole test: give each request a **fresh module graph** (`await import(entry + '?instance=' + n)`, or one child process per request when the feature also touches globals or `globalThis` caches), and **snapshot the side effects at the moment the handler resolves** rather than awaiting them. Wait, then diff the snapshot: anything that arrives late is work a frozen instance drops. Run at least two requests against two separate instances. Start from [examples/serverless-sim.mjs](./examples/serverless-sim.mjs) and adapt the entry path, the happy path, and the side-effect probe. Instances are short-lived, share no memory with each other, and freeze once the response is sent. Calling the same function twice in one process tests none of this: the module cache hands both calls the same instance, and it passes.
- [ ] **Browser.** Load the built package directly, through an import map or a path into `dist`, with no bundler. A bundler papers over a broken `exports` map, an ESM or CJS mismatch, and a stray Node builtin.
- [ ] **Mixed.** The server renders, the browser acts, and the action returns to the server.
- [ ] Note every point where you had to read the source, hand-build something internal, or work around the API. Each one is a finding.

## 2. Boundaries

- [ ] Two concurrent users, one shared instance. Does either see the other's data? Same harness, one warm instance: import the entry once, then run two calls concurrently against it.
- [ ] If sharing is unsafe, does the signature prevent it, or only the documentation?
- [ ] Can the caller await every side effect, including on a platform that offers no hook for it? Anything the caller cannot await is a floating promise (an unawaited, unhandled promise), and a frozen or torn-down instance drops it.
- [ ] Repeat the same call with identical input. Does it duplicate, overwrite, or no-op, and is that the documented behavior?

## 3. Environments

- [ ] Run it where the ambient thing is missing: no DOM, no origin, no filesystem.
- [ ] Invalid configuration: does it fail at construction, or once per call in a place where an error handler swallows it?

If the output feeds something counted, billed, or granted, verify the numbers rather than only that the call ran. Delivery succeeding and the aggregate being correct are different questions.
