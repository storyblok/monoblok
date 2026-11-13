export const TELEMETRY_ENDPOINT = "https://ingress.eu-west-1.aws.dash0.com";

/** Ingest-only, so it is safe to publish (ADR-0026). */
export const TELEMETRY_AUTH_TOKEN = "auth_8KsM3eynDxyKYfIjl4z5zeUSKhQOVOJV";

export const TELEMETRY_DATASET = "prd-storyblok-cli";

export const TELEMETRY_DOCS_URL = "https://www.storyblok.com/docs/tooling/cli/telemetry";

export const PRIVACY_NOTICE_URL = "https://www.storyblok.com/legal/privacy-policy";

/** Bump when the collected data widens; consent given under an older version then no longer counts. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Nobody waits for the detached sender. */
export const TELEMETRY_SENDER_TIMEOUT_MS = 10_000;

/** Build entry of `src/entrypoints/telemetry-sender.ts`, emitted next to the CLI's entry. */
export const TELEMETRY_SENDER_ENTRY = "telemetry-sender";

export const SERVICE_NAME = "storyblok-cli";

export const REDACTED = "[REDACTED]";

export const TELEMETRY_ENV = {
  /** Opt-out shared across tools, see https://consoledonottrack.com */
  DO_NOT_TRACK: "DO_NOT_TRACK",
  DISABLED: "STORYBLOK_TELEMETRY_DISABLED",
  /** Print the payload to stderr instead of sending it. */
  DEBUG: "STORYBLOK_TELEMETRY_DEBUG",
} as const;
