# ADR-0026: CLI Telemetry

**Status:** Accepted. **Date:** 2026-11-10

## Context

Bug reports against the CLI arrive without a sense of severity or prevalence: we can't tell whether
a failure affects two installs or two thousand, and npm download counts don't distinguish one
command from another. We want evidence for which commands fail, how often and with which error, and
which commands and versions are in use. User-facing details live on the docs site's CLI telemetry
page.

## Decisions

### 1. Opt-in, asked once, no preselected

The install ID and space ID make the data personal, so the CLI asks for consent on the first
interactive run and preselects no: a preselected yes is not valid consent under EU rules. It never
asks without a TTY, in CI, in a container (every run would ask again), or before the `telemetry`
command, and stays off there. The answer is stored globally with a schema version. Widening the
collected data bumps the version and asks those who said yes again; a no stays a no.
`STORYBLOK_TELEMETRY_DISABLED` and `DO_NOT_TRACK` override any stored answer.

### 2. Hand-rolled OTLP/JSON over `node:https`

One span (`storyblok.cli.command`) and two delta counters (`storyblok.cli.command.count`,
`storyblok.cli.error.count`) per run, posted to Dash0 as OTLP/JSON. The OpenTelemetry SDK would add
dependencies and startup time to every invocation for two requests we can build in a few lines, and
the debug mode can print exactly what is sent. Counters are deltas because each run is its own
process; spans expire after 30 days, so long-term numbers come from the counters. Attribute names
follow OpenTelemetry semantic conventions where they exist and use `storyblok.cli.*` otherwise.

`fetch` is not used: aborting it while the TCP connection is still being set up leaves the socket
holding the process open until undici's 10 s connect timeout, which a firewall that drops packets
turns into 10 s on every run. `node:https` releases the socket on abort.

### 3. Values from Commander's parsed state, sent unless denied

The invocation is read from what Commander parsed, not from raw argv: the deepest command dispatched
to (via `preSubcommand` hooks), the options whose value source is the command line, and the
processed arguments. Re-parsing argv would mean tracking Commander's rules by hand and can't tell
whether an unknown flag takes a value, so it would send that value as an argument. Unknown flags are
not sent at all; a rejected run sends its command, its known flags, and no arguments.

Values are sent by default. Data that Storyblok stores anyway (slugs, queries, component names) is
fine to send, and an allowlist per flag was too much overhead for it. Secrets and anything on the
user's machine are not: values are redacted when the option or argument name ends in token, secret,
password, path, file, filename, or dir, or when the definition is wrapped in `denyTelemetryValue()`.
The name is matched rather than the help placeholder, so a wording change in `--help` can't change
what is sent. Values over 200 characters are replaced, which drops inline data.

### 4. Errors as fixed codes

Errors are reduced to fixed codes (HTTP status, error class, Node.js system code), never their
message, which can carry paths, names, and server responses. The first error recorded wins: either
the one that ended the run, or the first failed item of a batch command, which otherwise exits
without any code.

### 5. Sent from a detached process

Dash0 takes about 0.9 s to answer an ingest request with data (60 ms when empty), and drops the data
when the client hangs up before the response. Awaiting it added about a second to every run (1.45 s
instead of 0.55 s for `storyblok user`), so the CLI hands the payload over stdin to a detached
process (`telemetry-sender.mjs`), which waits up to 10 s, and exits right away. Ctrl+C does the same
and exits 130. If the process can't be started, the CLI sends in-process with a 1.5 s timeout (400
ms on Ctrl+C). Prisma and the Next.js dev server send the same way; Astro awaits with a cap. Errors
are swallowed and a failed send isn't retried.

### 6. Ingest-only token in the package

The Dash0 token ships in the published package. It is scoped to ingesting into the CLI dataset;
rotating it requires a release.

### 7. CI and agent detection via `std-env`

`std-env` (no dependencies) detects about 50 CI providers and the common coding agents. Agent runs
are tagged with the agent's name, so they can be told apart from human runs; the free-form
`AI_AGENT` value is only sent when it looks like a name.

### 8. API requests join the run's trace

With telemetry enabled, requests to the Storyblok API carry a W3C `traceparent` header whose parent
is the run's span, so a failing run can be followed into the Management API's own traces. The CLI
writes to its own Dash0 dataset, since its ingest token is public, and Dash0 joins traces only
within one dataset: the API's spans are found by looking up the run's trace ID in the API's dataset,
where the run's span shows as a missing parent. The header is always flagged as sampled, so no run
loses its API side to the API's head sampling; the cost is that API volume extrapolated from the
sampling ratio counts these requests slightly high. Without consent, no header is sent.
