<!-- target: src/content/docs/docs/tooling/cli/telemetry.mdx (new page) -->
<!-- navigation: src/config/navigation/tooling.ts, add { label: "Telemetry", link: "docs/tooling/cli/telemetry" } after "Global options" -->

Frontmatter:

```yaml
title: "Telemetry"
description: "What usage data the Storyblok CLI collects, and how to opt in or out."
```

The Storyblok CLI can share usage data with Storyblok, which uses it to prioritize fixes and
features. Telemetry is off until you agree. The CLI asks once, on the first interactive run:

```text
? The Storyblok CLI can collect usage data to shape the roadmap and prioritize fixes.
  Privacy policy: https://www.storyblok.com/legal/privacy-policy
  Opt out at any time with storyblok telemetry disable.
  Share usage data? (y/N)
```

The CLI doesn’t ask in continuous integration (CI) environments, in containers, or without a
terminal. There, telemetry stays off unless you run `storyblok telemetry enable`.

## What the CLI collects

Each run sends the following data:

- The command, the flags and arguments you typed, and their values
- The outcome, the exit code, an error code such as `RATE_LIMITED`, and the duration
- The CLI, Node.js, and operating system versions, the package manager, and whether the run is in CI
  or a coding agent
- The space ID and a random install ID

The CLI replaces tokens, passwords, and local file paths with `[REDACTED]`. It never sends error
messages, file contents, or environment variable values.

Requests to the Storyblok API include a trace ID, so Storyblok can match them to the run.

## Inspect the data

To print the data to stderr instead of sending it, set `STORYBLOK_TELEMETRY_DEBUG`:

```bash
STORYBLOK_TELEMETRY_DEBUG=1 storyblok components pull --space 12345
```

## Opt out

To stop sharing usage data, run:

```bash
storyblok telemetry disable
```

To turn telemetry off regardless of the stored answer, set `STORYBLOK_TELEMETRY_DISABLED=1` or
`DO_NOT_TRACK=1`.

## Commands

| Command                       | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `storyblok telemetry status`  | Shows whether telemetry is enabled.                  |
| `storyblok telemetry enable`  | Shares usage data.                                   |
| `storyblok telemetry disable` | Stops sharing usage data and deletes the install ID. |
