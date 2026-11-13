<!-- target: src/content/docs/docs/tooling/cli/telemetry.mdx (new page) -->
<!-- navigation: src/config/navigation/tooling.ts, add { label: "Telemetry", link: "docs/tooling/cli/telemetry" } after "Global options" -->

Frontmatter:

```yaml
title: "Telemetry in the CLI"
description: "What usage data the Storyblok CLI shares, and how to opt in or out."
```

The Storyblok CLI can share usage data with Storyblok, which uses it to prioritize fixes and
features. Telemetry is off until you agree. The CLI asks once, on the first interactive run:

```text
? The Storyblok CLI can share usage data with Storyblok to prioritize fixes and features.
  What is shared: https://www.storyblok.com/docs/tooling/cli/telemetry
  Privacy policy: https://www.storyblok.com/legal/privacy-policy
  Opt out at any time with storyblok telemetry disable.
  Share usage data? (y/N)
```

The CLI doesn’t ask in continuous integration (CI) environments, in containers, in coding agents, or
without a terminal. There, telemetry stays off unless you run `storyblok telemetry enable`.

## Collected data

Each run sends the following data:

- The command and the names of the flags and arguments you typed
- The values of flags that are on or off, numbers, and fixed choices such as `--validate strict`.
  Every other value, such as a slug, search text, token, or file path, is sent as `[REDACTED]`.
- The outcome, the exit code, an error code such as `RATE_LIMITED`, and the duration
- The CLI and Node.js versions, the operating system, the CPU architecture, and the package manager
- Whether the run is in CI, and the name of the coding agent that ran it, if any
- The space ID, the region, and a random install ID

The CLI never sends error messages or file contents.

With telemetry enabled, requests to the Storyblok Management API include a trace ID that links them
to the run.

Storyblok stores the data in the EU. `storyblok telemetry disable` deletes the install ID from your
machine, but not data already sent. To request its deletion, follow the privacy policy and include
the install ID that `storyblok telemetry status` shows.

## Debug mode

To print the data to stderr instead of sending it, set `STORYBLOK_TELEMETRY_DEBUG`:

```bash
STORYBLOK_TELEMETRY_DEBUG=1 storyblok components pull --space 12345
```

## Opt in or out

| Command                       | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `storyblok telemetry status`  | Shows whether telemetry is enabled.             |
| `storyblok telemetry enable`  | Turns telemetry on.                             |
| `storyblok telemetry disable` | Turns telemetry off and deletes the install ID. |

To turn telemetry off regardless of your answer to the prompt, set `STORYBLOK_TELEMETRY_DISABLED=1`
or `DO_NOT_TRACK=1`.
