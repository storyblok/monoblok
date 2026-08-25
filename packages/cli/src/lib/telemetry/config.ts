import { DEFAULT_DATASET, DEFAULT_OTLP_ENDPOINT, DEFAULT_SERVICE_NAME } from "./constants";

/** Why a run has nothing to export, for the debug output to explain itself. */
export type ExportDisabledReason = "do-not-track" | "opted-out" | "no-token";

export interface TelemetrySettings {
  /** OTLP base URL, without the signal path. */
  endpoint: string;
  /** Dash0 ingest token. Empty means nothing leaves the machine. */
  token: string;
  /** Dash0 dataset the spans are written to. */
  dataset: string;
  /** Value reported as `service.name`. */
  serviceName: string;
  /** Print the run's telemetry to stderr instead of (or in addition to) exporting it. */
  debug: boolean;
  /** Set whenever `token` is empty, so the debug output can say why. */
  exportDisabledReason?: ExportDisabledReason;
}

export interface ResolveTelemetrySettingsInput {
  /**
   * `telemetry.enabled` as resolved by the config chain. Tri-state on purpose:
   * `undefined` means nobody expressed an opinion, so the environment decides.
   */
  enabled?: boolean;
  /** `telemetry.debug` as resolved by the config chain. Tri-state, like `enabled`. */
  debug?: boolean;
  env?: NodeJS.ProcessEnv;
}

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY_VALUES.has(value.trim().toLowerCase());
}

// A tri-state config value decides on its own; `undefined` falls back to the environment.
function resolveSwitch(configured: boolean | undefined, envValue: string | undefined): boolean {
  return configured ?? isTruthy(envValue);
}

/**
 * Resolve what a run should do with its telemetry, or `null` when there is nothing to do.
 *
 * Two independent switches:
 *
 * - **Export** (`--telemetry-enabled` / `telemetry.enabled` / `STORYBLOK_TELEMETRY_ENABLED=1`)
 *   sends spans to Dash0. `DO_NOT_TRACK` overrides it, and a missing `DASH0_TOKEN` disables it
 *   too, since there would be nowhere to send them.
 * - **Debug** (`--telemetry-debug` / `telemetry.debug` / `STORYBLOK_TELEMETRY_DEBUG=1`) prints
 *   the run's telemetry to stderr. It never sends anything, so it keeps working under
 *   `DO_NOT_TRACK` and without a token: it is how you inspect what the CLI would report.
 */
export function resolveTelemetrySettings(
  input: ResolveTelemetrySettingsInput = {},
): TelemetrySettings | null {
  const env = input.env ?? process.env;

  const debug = resolveSwitch(input.debug, env.STORYBLOK_TELEMETRY_DEBUG);
  const optedIn = resolveSwitch(input.enabled, env.STORYBLOK_TELEMETRY_ENABLED);
  const configuredToken = env.DASH0_TOKEN?.trim() ?? "";

  let exportDisabledReason: ExportDisabledReason | undefined;
  if (isTruthy(env.DO_NOT_TRACK)) {
    exportDisabledReason = "do-not-track";
  } else if (!optedIn) {
    exportDisabledReason = "opted-out";
  } else if (!configuredToken) {
    exportDisabledReason = "no-token";
  }

  const token = exportDisabledReason ? "" : configuredToken;
  if (!token && !debug) {
    return null;
  }

  return {
    endpoint: (env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || DEFAULT_OTLP_ENDPOINT).replace(
      /\/+$/,
      "",
    ),
    token,
    dataset: env.DASH0_DATASET?.trim() || DEFAULT_DATASET,
    serviceName: env.OTEL_SERVICE_NAME?.trim() || DEFAULT_SERVICE_NAME,
    debug,
    ...(exportDisabledReason ? { exportDisabledReason } : {}),
  };
}

/** Whether the run happens on a build agent, so CI traffic can be split out in Dash0. */
export function isCiEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isTruthy(env.CI) ||
    Boolean(env.GITHUB_ACTIONS || env.GITLAB_CI || env.CIRCLECI || env.BUILDKITE || env.JENKINS_URL)
  );
}
