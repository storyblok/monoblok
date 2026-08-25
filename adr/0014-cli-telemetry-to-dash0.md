# ADR-0014: CLI Telemetry to Dash0

**Status:** Accepted **Date:** 2026-08-19

## Context

The Storyblok platform standardized on [Dash0](https://www.dash0.com) for observability. The backend
services and the Storyblok app both export OpenTelemetry data straight to the Dash0 OTLP ingress —
no collector in between — authenticated with a bearer token and routed to a dataset through the
`Dash0-Dataset` header. The env contract is the same everywhere: `OTEL_EXPORTER_OTLP_ENDPOINT`
carries the base URL (the signal path is appended by the exporter), `DASH0_TOKEN` the credential,
`DASH0_DATASET` the destination, and an SDK-level switch keeps instrumentation completely off unless
it is explicitly turned on.

The `storyblok` CLI had no equivalent. When a command fails in the field, the only evidence is what
the user is willing to reproduce and paste: the local `.storyblok/logs` JSONL file, a report file,
or a `--verbose` transcript. There is no way to see which commands are actually used, how long they
take, which failures are common, or which CLI and Node versions are still in the wild.

A CLI is not a server, so the backend's configuration cannot be ported literally:

- **It is a short-lived process.** A metrics reader on a 60s interval never gets to export, and a
  batch of spans has to be flushed before the process exits — while never making the user wait.
- **It runs on other people's machines.** Command arguments carry space ids, file paths, and tokens;
  error messages interpolate API payloads. None of that may be exported.
- **It is published publicly.** Any credential shipped in the tarball is public, so enabling
  telemetry for end users is a product decision (notice, opt-out, a scoped ingest token), not an
  implementation detail.

## Decision

Instrument the CLI with OpenTelemetry traces exported to the Dash0 dataset `prd-storyblok-cli`,
**off by default**, in `packages/cli/src/lib/telemetry/`.

1. **One span per run, traces only.** A run opens a single span named `storyblok <command>` in the
   `preAction` hook and closes it in the entrypoint's `finally`, so both successful and failed runs
   are recorded. Rates, durations, and error ratios are derived from spans in Dash0 rather than
   exported as metrics: a process that lives for a few seconds cannot feed a periodic metric reader.
2. **Off unless someone opts in.** `telemetry.enabled` (config file or `--telemetry-enabled`) and
   `STORYBLOK_TELEMETRY_ENABLED=1` turn it on; `--no-telemetry-enabled` and the cross-vendor
   `DO_NOT_TRACK` turn it off, with `DO_NOT_TRACK` overriding everything. The config value is
   tri-state: `undefined` means nobody decided, which leaves the decision to the environment.
3. **No credential ships with the package.** Without `DASH0_TOKEN` the resolution returns "off", so
   the released CLI stays inert until a token is provisioned deliberately. The rest of the transport
   reuses the platform's env contract (`OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_DATASET`,
   `OTEL_SERVICE_NAME`) with CLI-appropriate defaults.
4. **Attributes are an allowlist, never a capture.** The span carries the command path, the _names_
   of the flags that were passed, the region, the run id, the exit code, and — on failure — the
   error type, its symbolic id, and the HTTP status. Flag values, arguments, paths, space ids, and
   error messages are never attached. Custom keys use the `sb.` namespace, because `dash0.` is owned
   by Dash0 and unrecognized keys in it are dropped at ingestion.
5. **Never in the way.** Every OpenTelemetry package is imported lazily, so a run with telemetry off
   pays for nothing beyond reading a few env vars. The final flush is raced against a 3s timeout,
   and every telemetry failure is swallowed into a debug log line.
6. **A dedicated dataset.** CLI traffic lands in `prd-storyblok-cli` rather than mixing into the
   application datasets, where its cardinality and volume profile do not belong.
7. **Inspectable from the terminal.** `--telemetry-debug` prints the run's telemetry to stderr,
   rendered from the same attribute objects the exporter receives. It is a separate switch from the
   export: it needs no token, survives `DO_NOT_TRACK` because it sends nothing, and names either the
   trace id to look up or the switch that kept the span at home. A telemetry pipeline nobody can see
   is a telemetry pipeline nobody trusts — and "why is nothing in Dash0" is otherwise undebuggable
   from the outside.

## Alternatives Considered

- **Port the backend setup literally (traces + a periodic metric reader).** Rejected: the reader's
  export interval outlives the process. Span-derived metrics give the same dashboards without the
  lifecycle problem.
- **Hand-rolled OTLP payload with no dependencies.** Attractive for install size and startup, and a
  single span barely needs an SDK. Rejected: it would have to be replaced the moment the CLI traces
  its own HTTP calls or propagates `traceparent` into the Management API, and the lazy import
  already keeps the cost off the default path.
- **On by default with an opt-out, the common CLI convention.** Deferred: it requires a public
  ingest token in the package, a first-run notice, and a privacy page. The plumbing here is
  compatible with that decision; flipping the default is a separate, deliberate change.
- **Export to the application dataset for end-to-end correlation with backend traces.** Deferred: it
  buys trace continuity from a command to the API request it triggers, but only once the CLI
  propagates `traceparent`, and it mixes public-client traffic into an internal dataset. Revisit
  together with HTTP-level instrumentation.

## Consequences

- **Nothing is emitted by default.** A released CLI with no token and no opt-in behaves exactly as
  before; the feature is immediately usable for internal runs and CI by exporting `DASH0_TOKEN` and
  `STORYBLOK_TELEMETRY_ENABLED=1`.
- **Dashboards must be built on spans**, not on exported metrics.
- **The debug output is a public contract.** It renders whatever is on the span, so an attribute
  added carelessly shows up in a user's terminal as well as in Dash0 — a second reason to keep the
  allowlist tight.
- **Usage errors are invisible.** The span opens in `preAction`, so an unknown command or a rejected
  flag — rejected before any hook runs — is never recorded. Accepted: those failures never reach the
  code the telemetry exists to observe.
- **An enabled run can take up to 3s longer to exit** when the ingress is slow or unreachable, and
  no longer than that.
- **The attribute allowlist is a maintenance commitment.** Anything added to a span has to be
  justified against it; "just add the space id" is the exact change this design exists to prevent.
- **Four `@opentelemetry/*` packages are now CLI dependencies**, installed for everyone but loaded
  only when telemetry runs.
