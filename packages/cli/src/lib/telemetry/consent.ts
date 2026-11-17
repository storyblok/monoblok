import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "pathe";
import { saveToFile } from "../../utils/filesystem";
import { TELEMETRY_ENV, TELEMETRY_SCHEMA_VERSION } from "./config";
import { isTruthyEnv } from "./environment";

type StoredConsent = {
  enabled: boolean;
  decidedAt: string;
  schemaVersion: number;
  installId?: string;
};

export type TelemetryStatus =
  | { enabled: true; installId: string }
  | { enabled: false; reason: "declined" | "undecided" }
  | { enabled: false; reason: "environment"; variable: string };

const OPT_OUT_VARIABLES = [TELEMETRY_ENV.DISABLED, TELEMETRY_ENV.DO_NOT_TRACK];

/** `homedir()` instead of `getStoryblokGlobalPath()`, which falls back to the working directory without `HOME`. */
export const getConsentFilePath = () => join(homedir(), ".storyblok", "telemetry.json");

function isStoredConsent(value: unknown): value is StoredConsent {
  return (
    typeof value === "object" &&
    value !== null &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    "decidedAt" in value &&
    typeof value.decidedAt === "string" &&
    "schemaVersion" in value &&
    typeof value.schemaVersion === "number" &&
    (!("installId" in value) ||
      value.installId === undefined ||
      typeof value.installId === "string")
  );
}

function readConsent(): StoredConsent | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getConsentFilePath(), "utf8"));
    return isStoredConsent(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function getOptOutVariable(): string | undefined {
  return OPT_OUT_VARIABLES.find((variable) => isTruthyEnv(process.env[variable]));
}

/** Synchronous, so a run can still be sent while the process exits. */
export function getTelemetryStatus(): TelemetryStatus {
  const variable = getOptOutVariable();
  if (variable) {
    return { enabled: false, reason: "environment", variable };
  }

  const consent = readConsent();
  if (!consent) {
    return { enabled: false, reason: "undecided" };
  }
  // A no to less data is a no to more, so only a yes is asked again after the data widens.
  if (!consent.enabled || !consent.installId) {
    return { enabled: false, reason: "declined" };
  }
  if (consent.schemaVersion < TELEMETRY_SCHEMA_VERSION) {
    return { enabled: false, reason: "undecided" };
  }
  return { enabled: true, installId: consent.installId };
}

/** Returns the install ID it deleted, which a request to delete the data already sent needs. */
export async function saveConsent(enabled: boolean): Promise<string | undefined> {
  const previous = readConsent();
  // Re-enabling after an opt-out creates a fresh ID, so runs before and after can't be linked.
  const installId = enabled ? (previous?.enabled && previous.installId) || randomUUID() : undefined;
  const consent: StoredConsent = {
    enabled,
    decidedAt: new Date().toISOString(),
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    ...(installId && { installId }),
  };
  await saveToFile(getConsentFilePath(), JSON.stringify(consent, null, 2), { mode: 0o600 });
  return previous?.installId !== installId ? previous?.installId : undefined;
}
