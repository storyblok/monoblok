import https from "node:https";

export type TelemetryRequest = { url: string; headers: Record<string, string>; body: string };

/**
 * `node:https` instead of `fetch`: aborting a `fetch` that is still connecting leaves the socket
 * holding the process open until the connect timeout (10 s), e.g. behind a firewall that drops
 * packets.
 */
function post({ url, headers, body }: TelemetryRequest, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
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

/** Never rejects. */
export async function postAll(requests: readonly TelemetryRequest[], timeoutMs: number) {
  const signal = AbortSignal.timeout(timeoutMs);
  await Promise.all(requests.map((request) => post(request, signal)));
}

function isTelemetryRequest(value: unknown): value is TelemetryRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "body" in value &&
    typeof value.body === "string" &&
    "headers" in value &&
    typeof value.headers === "object" &&
    value.headers !== null
  );
}

export function parseTelemetryRequests(json: string): TelemetryRequest[] {
  const value: unknown = JSON.parse(json);
  return Array.isArray(value) ? value.filter(isTelemetryRequest) : [];
}
