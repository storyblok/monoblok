# ADR-0026: CLI Telemetry

**Status:** Accepted. **Date:** 2026-11-10

## Context

Bug reports against the CLI arrive without a sense of severity or prevalence: we can't tell whether
a failure affects two installs or two thousand, and npm download counts don't distinguish one
command from another. We want evidence for which commands fail, how often and with which error, and
which commands and versions are in use. User-facing details live on the docs site's CLI telemetry
page.

## Decisions

### 1. Opt-in, asked once, no by default

The install ID and space ID make the data personal, so the CLI asks for consent on the first
interactive run and defaults to no: a preselected yes is not valid consent under EU rules. It never
asks without a TTY, in CI, in a container (every run would ask again), in a coding agent (its answer
isn't the user's), in debug mode, or before the `telemetry` command, and stays off there. CI runs
are therefore rare in the data unless a team runs `storyblok telemetry enable` there. The answer is
stored globally with a schema version. Widening the collected data bumps the version and asks those
who said yes again; a no stays a no. `STORYBLOK_TELEMETRY_DISABLED` and `DO_NOT_TRACK` override any
stored answer.

### 2. Hand-rolled OTLP/JSON over `node:https`

One span (`storyblok.cli.command`) and two delta counters (`storyblok.cli.command.count`,
`storyblok.cli.error.count`) per run, posted to Dash0 as OTLP/JSON. The OpenTelemetry SDK would add
dependencies and startup time to every invocation for two requests we can build in a few lines, and
the debug mode can print exactly what is sent. Counters are deltas because each run is its own
process; spans aren't kept long-term, so long-term numbers come from the counters. Attribute names
follow OpenTelemetry semantic conventions where they exist and use `storyblok.cli.*` otherwise.

`fetch` is not used: aborting it while the TCP connection is still being set up leaves the socket
holding the process open until undici's 10 s connect timeout, which a firewall that drops packets
turns into 10 s on every run. `node:https` releases the socket on abort.

### 3. Values from Commander's parsed state, only when they can't carry user data

The invocation is read from what Commander parsed, not from raw argv: the deepest command dispatched
to, the options whose value source is the command line, and the processed arguments. Re-parsing argv
would mean tracking Commander's rules by hand and can't tell whether an unknown flag takes a value,
so it would send that value as an argument. Unknown flags are not sent at all; a rejected run sends
its command, its known flags, and no arguments.

Only booleans, numbers, and values from an option's or argument's `choices()` are sent; every other
value becomes `[REDACTED]`. Free text such as search terms and filter queries can hold personal data
from a space's content, which the customer, not the CLI's analytics, is responsible for. Redacting
by name (`--token`, `--path`) was tried first, but missed free text and left every new option to its
author's judgment; with an allowlist by shape, a new option is safe without anyone remembering it.

### 4. Errors as fixed codes

Errors are reduced to fixed codes (HTTP status, error class, Node.js system code), never their
message, which can carry paths, names, and server responses. An unmapped error class is reported by
its name (`TimeoutError` → `TIMEOUT_ERROR`), which is code, never user data. The first error
recorded wins: either the one that ended the run, or the first failed item of a batch command. A run
that exits 0 counts as a success even if it logged an error, and a non-zero exit without an error
counts as `findings`: commands such as `schema diff --exit-code` report a result through the exit
code.

### 5. Sent from a detached process

Dash0 takes about 0.9 s to answer an ingest request with data (60 ms when empty), and drops the data
when the client hangs up before the response. Awaiting it added about a second to every run (1.45 s
instead of 0.55 s for `storyblok user`), so the CLI hands the payload over stdin to a detached
process (`telemetry-sender.mjs`) that waits up to 10 s, and the CLI exits right away. Prisma and
Next.js also send from a detached process; Next.js passes the events in a file instead of stdin.
Astro awaits with a cap. Errors are swallowed, and a failed send is neither retried nor sent
in-process.

Only when telemetry is on does the CLI listen for Ctrl+C: it sends the run, then re-raises the
signal, so shells and scripts still see the process die from it.

### 6. Ingest-only token in the package

The Dash0 token ships in the published package. It is scoped to ingesting into the CLI dataset;
rotating it requires a release.

### 7. CI and agent detection via `std-env`

`std-env` (no dependencies) detects about 50 CI providers and the common coding agents. Agent runs
are tagged with the first word of the agent's name, so they can be told apart from human runs and
the free-form `AI_AGENT` value (`claude-code_2-1-322_agent`) counts with the variable-based one
(`claude`).

### 8. API requests join the run's trace

With telemetry enabled, requests to the Storyblok Management API carry a W3C `traceparent` header
whose parent is the run's span, always flagged as sampled, so Storyblok can follow a failing run
into the API. The trace ID is also in the run's log file. The CLI writes to its own Dash0 dataset
because its ingest token is public. Without consent, no header is sent.
