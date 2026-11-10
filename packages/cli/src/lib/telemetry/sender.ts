import { TELEMETRY_SENDER_TIMEOUT_MS } from "./config";
import { parseTelemetryRequests, postAll } from "./transport";

/** Runs in the detached process: reads the requests from stdin and posts them. */
export async function runSender(
  input: AsyncIterable<string | Buffer>,
  timeoutMs = TELEMETRY_SENDER_TIMEOUT_MS,
): Promise<void> {
  try {
    let json = "";
    for await (const chunk of input) {
      json += chunk;
    }
    await postAll(parseTelemetryRequests(json), timeoutMs);
  } catch {
    // Nobody is left to tell.
  }
}
