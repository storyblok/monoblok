# ADR-0026: CLI Telemetry

**Status:** Accepted. **Date:** 2026-11-10

## Context

Bug reports don't show how many installs a failure affects, and npm download counts don't
distinguish commands. We want to know which commands and versions are in use, which fail, how often,
and with which error. User-facing details live on the docs site's CLI telemetry page.

## Decisions

### 1. Opt-in, asked once, no by default

The install ID and space ID make the data personal, so the CLI asks for consent on the first
interactive run and defaults to no: a preselected yes is not valid consent under EU rules. It never
asks without a TTY, in CI, in a container (every run would ask again), in a coding agent (its answer
isn't the user's), in debug mode, or before the `telemetry` command, and stays off there. CI runs
are therefore rare in the data unless a team runs `storyblok telemetry enable` there. The answer is
stored globally with a schema version. Widening the collected data bumps the version and asks those
who said yes again; a no stays a no. Widening means a new kind of data: a new flag whose value
passes the rules of decision 3 is not. `STORYBLOK_TELEMETRY_DISABLED` and `DO_NOT_TRACK` override
any stored answer.

The CLI asks before the first command runs, as Angular CLI and Nuxt do, not after it or only after
`login`: a run must not send anything before its user has answered. Ctrl+C at the prompt cancels the
command and stores nothing. A coding agent can run `storyblok telemetry enable`: it is very unlikely
to do so unless its user asks.

The answer lives in the user's home directory, not next to the credentials, whose folder falls back
to the working directory when `HOME` is unset: consent must not depend on where the CLI runs.
Enabling again after an opt-out creates a new install ID, so runs before and after can't be linked.

### 2. Hand-rolled OTLP/JSON over `node:https`

One span (`storyblok.cli.command`) and two delta counters (`storyblok.cli.command.count`,
`storyblok.cli.error.count`) per run, posted to Dash0 as OTLP/JSON. The OpenTelemetry SDK would add
dependencies and startup time to every invocation for two requests we can build in a few lines, and
the debug mode can print exactly what is sent. Counters are deltas because each run is its own
process; spans aren't kept long-term, so long-term numbers come from the counters. How Dash0 sums
deltas from many short-lived processes is not verified, so the counters are approximate and the
spans are the reference while they are retained.

`fetch` is not used: aborting it while the TCP connection is still being set up leaves the socket
holding the process open until undici's 10 s connect timeout, which a firewall that drops packets
turns into 10 s on every run. `node:https` releases the socket on abort.

### 3. Values from Commander's parsed state, only when they can't carry user data

The invocation is read from what Commander parsed, not from raw argv: the deepest command dispatched
to, the options whose value source is the command line, and the processed arguments. Re-parsing argv
would mean tracking Commander's rules by hand and can't tell whether an unknown flag takes a value,
so it would send that value as an argument. Unknown flags are not sent at all; a rejected run sends
its command, its known flags, and no arguments. A run rejected while a global option is parsed is
attributed to `storyblok`, because Commander has not dispatched to a command yet.

Only booleans, numbers, and values from an option's or argument's `choices()` are sent; every other
value becomes `[REDACTED]`. Free text such as search terms and filter queries can hold personal data
from a space's content, which must not reach analytics. Redacting by name (`--token`, `--path`) was
tried first, but missed free text and left every new option to its author's judgment; with an
allowlist by shape, a new option is safe without anyone remembering it. Numbers are sent as parsed,
including a non-finite or oversized one from invalid input: losing that attribute, or that run, is
acceptable for a usage mistake.

### 4. Errors as fixed codes

Errors are reduced to fixed codes (HTTP status, error class, Node.js system code), never their
message, which can carry paths, names, and server responses. An unmapped error class is reported by
its name (`TimeoutError` → `TIMEOUT_ERROR`), and an agent by the first word of its name. Both are
identifiers, pattern-checked and capped in length. A name defined in a user's own code can appear
this way, which is accepted: an allowlist would hide the error classes and agents we did not
anticipate, and those are the ones worth seeing.

A run that exits 0 counts as a success even if it logged an error, because some commands recover
from a failed item. Commands that report a result through the exit code, such as
`schema diff --exit-code`, mark the run as `findings`. Any other non-zero exit counts as an error,
so a failure that bypasses the error handling is still counted.

### 5. Sent from a detached process

Dash0 takes about 0.9 s to answer an ingest request with data (60 ms when empty), and drops the data
when the client hangs up before the response. Awaiting it added about a second to every run (1.45 s
instead of 0.55 s for `storyblok user`), so the CLI hands the payload to a detached process
(`telemetry-sender.mjs`) that waits up to 3 s, and the CLI exits right away. Prisma and Next.js also
send from a detached process; Astro awaits with a cap. A failed send is dropped: usage counts
tolerate gaps.

The payload goes through a temporary file, as in Next.js, not over stdin: writing the file and
spawning the sender are synchronous, so a run can also be sent from the `exit` event. That covers
uncaught errors and `process.exit()`, the failures most worth counting, which a send at the end of
the entry file never reaches. The sender holds the endpoint and token and only reads the payload
file, so the package doesn't ship a general-purpose HTTP client.

The CLI listens for Ctrl+C only when telemetry or its debug mode is on. It sends the run, then
re-raises the signal, so shells and scripts still see the process die from it. A process killed by
another signal is not recorded.

### 6. Ingest-only token in the package

The Dash0 token ships in the published package. It is scoped to ingesting into a dataset that holds
only CLI data. Endpoint and token are fixed per published version, so rotating the token or changing
the vendor requires a release and silences older versions. An ingest endpoint of our own that
forwards to the vendor would avoid that, as Next.js, Nuxt, and Astro do, but is a service to run for
data that tolerates gaps.

### 7. CI and agent detection via `std-env`

`std-env` (no dependencies) detects about 50 CI providers and the common coding agents. Agent runs
are tagged with the first word of the agent's name, so they can be told apart from human runs and
the free-form `AI_AGENT` value (`claude-code_2-1-322_agent`) counts with the variable-based one
(`claude`).

### 8. API requests join the run's trace

With telemetry enabled, requests to the Storyblok Management API carry a W3C `traceparent` header
whose parent is the run's span, so Storyblok can follow a failing run into the API. The header is
flagged as sampled: an unsampled parent would make the API drop the trace, and with it the link. The
link is the point, and it makes what the API records about those requests joinable to the run. That
is one more reason the data counts as personal and needs consent. Without consent, and in debug
mode, no header is sent.
