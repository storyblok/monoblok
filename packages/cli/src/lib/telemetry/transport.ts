import { readFileSync, rmSync } from "node:fs";
import https from "node:https";
import { basename } from "pathe";
import {
  TELEMETRY_AUTH_TOKEN,
  TELEMETRY_DATASET,
  TELEMETRY_ENDPOINT,
  TELEMETRY_PAYLOAD_FILE_PREFIX,
  TELEMETRY_SENDER_TIMEOUT_MS,
} from "./config";

export type TelemetryPayloads = { traces: unknown; metrics: unknown };

/**
 * `node:https` instead of `fetch`: aborting a `fetch` that is still connecting leaves the socket
 * holding the process open until the connect timeout (10 s), e.g. behind a firewall that drops
 * packets.
 */
function post(path: string, payload: unknown, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      `${TELEMETRY_ENDPOINT}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${TELEMETRY_AUTH_TOKEN}`,
          "Dash0-Dataset": TELEMETRY_DATASET,
        },
        signal,
      },
      (response) => {
        response.on("close", resolve);
        response.resume();
      },
    );
    req.on("error", () => resolve());
    req.end(body);
  });
}

function isTelemetryPayloads(value: unknown): value is TelemetryPayloads {
  return typeof value === "object" && value !== null && "traces" in value && "metrics" in value;
}

/** Runs in the detached process. Never rejects. */
export async function runSender(
  payloadFile: string | undefined,
  timeoutMs = TELEMETRY_SENDER_TIMEOUT_MS,
): Promise<void> {
  try {
    if (!payloadFile || !basename(payloadFile).startsWith(TELEMETRY_PAYLOAD_FILE_PREFIX)) {
      return;
    }
    const json = readFileSync(payloadFile, "utf8");
    rmSync(payloadFile, { force: true });
    const payloads: unknown = JSON.parse(json);
    if (!isTelemetryPayloads(payloads)) {
      return;
    }
    const signal = AbortSignal.timeout(timeoutMs);
    await Promise.all([
      post("/v1/traces", payloads.traces, signal),
      post("/v1/metrics", payloads.metrics, signal),
    ]);
  } catch {
    // The CLI has exited; there is nowhere to report to.
  }
}
