export const TELEMETRY_ENDPOINT = "https://ingress.eu-west-1.aws.dash0.com";

/** Ingest-only, so it is safe to publish (ADR-0027). */
export const TELEMETRY_AUTH_TOKEN = "auth_8KsM3eynDxyKYfIjl4z5zeUSKhQOVOJV";

/**
 * Inlined at build time. Only the publish workflow sets the production dataset, so local builds and
 * PR previews can't mix test runs into production data.
 */
export const TELEMETRY_DATASET = process.env.STORYBLOK_TELEMETRY_DATASET || "dev-storyblok-cli";

export const TELEMETRY_DOCS_URL = "https://www.storyblok.com/docs/tooling/cli/telemetry";

export const PRIVACY_POLICY_URL = "https://www.storyblok.com/legal/privacy-policy";

/** Bump when the collected data widens; consent given under an older version then no longer counts. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Generous: the run doesn't wait for the detached sender. */
export const TELEMETRY_SENDER_TIMEOUT_MS = 3_000;

/** The sender only reads and deletes files with this name prefix. */
export const TELEMETRY_PAYLOAD_FILE_PREFIX = "storyblok-telemetry-";

export const SERVICE_NAME = "storyblok-cli";

export const REDACTED = "[REDACTED]";

export const TELEMETRY_ENV = {
  /** Opt-out shared across tools, see https://donottrack.sh */
  DO_NOT_TRACK: "DO_NOT_TRACK",
  DISABLED: "STORYBLOK_TELEMETRY_DISABLED",
  /** Print the payload to stderr instead of sending it. */
  DEBUG: "STORYBLOK_TELEMETRY_DEBUG",
} as const;
