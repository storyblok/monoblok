export const TELEMETRY_ENDPOINT = "https://ingress.eu-west-1.aws.dash0.com";

/** Ingest-only, so it is safe to publish (ADR-0026). Empty disables sending. */
export const TELEMETRY_AUTH_TOKEN: string = "auth_8KsM3eynDxyKYfIjl4z5zeUSKhQOVOJV";

export const TELEMETRY_DATASET: string = "prd-storyblok-cli";

export const PRIVACY_NOTICE_URL = "https://www.storyblok.com/legal/privacy-policy";

/** Bump when the collected data widens; consent given under an older version then no longer counts. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Sending in-process, when the detached sender can't start. */
export const TELEMETRY_TIMEOUT_MS = 1500;

/** The user is waiting for an interrupted run to stop. */
export const TELEMETRY_INTERRUPT_TIMEOUT_MS = 400;

/** Nobody waits for the detached sender, and Dash0 takes about a second to answer. */
export const TELEMETRY_SENDER_TIMEOUT_MS = 10_000;

/** Built from `src/entrypoints/telemetry-sender.ts` next to the CLI's entry. */
export const TELEMETRY_SENDER_FILENAME = "telemetry-sender.mjs";

export const SERVICE_NAME = "storyblok-cli";

export const REDACTED = "[REDACTED]";

/** Longer values are mostly inline data. */
export const MAX_VALUE_LENGTH = 200;

export const TOO_LONG = "[TOO_LONG]";

export const TELEMETRY_ENV = {
  /** Opt-out shared across tools, see https://consoledonottrack.com */
  DO_NOT_TRACK: "DO_NOT_TRACK",
  DISABLED: "STORYBLOK_TELEMETRY_DISABLED",
  /** Print the payload to stderr instead of sending it. */
  DEBUG: "STORYBLOK_TELEMETRY_DEBUG",
} as const;
