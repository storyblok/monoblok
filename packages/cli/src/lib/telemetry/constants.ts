/**
 * Dash0 OTLP ingress. The base URL only — the signal path (`/v1/traces`) is appended
 * by the exporter, matching how the rest of the platform configures
 * `OTEL_EXPORTER_OTLP_ENDPOINT`.
 */
export const DEFAULT_OTLP_ENDPOINT = "https://ingress.eu-west-1.aws.dash0.com";

/** Dash0 dataset that stores CLI telemetry, kept apart from the application datasets. */
export const DEFAULT_DATASET = "prd-storyblok-cli";

/** `service.name` reported for every CLI run. */
export const DEFAULT_SERVICE_NAME = "storyblok-cli";

/**
 * Upper bound for the export at the end of a run. A CLI must never make the user wait
 * on telemetry, so the flush is raced against this timeout and abandoned when it wins.
 */
export const EXPORT_TIMEOUT_MS = 3000;

/** Instrumentation scope of the spans this module emits. */
export const INSTRUMENTATION_SCOPE = "storyblok.cli";

/**
 * Custom attributes use the "sb." namespace on purpose: "dash0." is owned by Dash0 and
 * unrecognized keys in it are dropped at ingestion.
 */
export const ATTRIBUTE_PREFIX = "sb.cli";
