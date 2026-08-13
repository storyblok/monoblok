import { createServer } from "node:http";
import { CommandError } from "../../utils";
import { describePortConflict } from "./port";

const page = (heading: string, message: string): string =>
  `<!doctype html><html><body style="font-family: sans-serif; text-align: center; padding-top: 4rem;">
<h1>${heading}</h1><p>${message}</p>
</body></html>`;

const SUCCESS_PAGE = page(
  "Storyblok CLI",
  "Authorization received. You can close this tab and return to the terminal.",
);
const ERROR_PAGE = page(
  "Storyblok CLI",
  "Authorization failed. You can close this tab and return to the terminal.",
);

export interface CallbackListener {
  /** Settles when the browser hits the redirect URI, or the wait times out. */
  callback: Promise<{ code: string; state: string }>;
  /** Stops listening. Safe to call after `callback` has already settled. */
  close: () => void;
}

/**
 * Binds the loopback callback server and resolves only once it is actually listening, so a
 * caller can confirm the port is free *before* sending the user to the consent screen. A bind
 * failure (typically `EADDRINUSE`) rejects this promise rather than the callback promise —
 * otherwise a doomed run would still open a browser tab it can never collect a code from.
 */
export const startCallbackServer = (
  port: number,
  path: string,
  timeoutMs = 300_000,
): Promise<CallbackListener> => {
  return new Promise((ready, failToStart) => {
    let listening = false;
    let timer: NodeJS.Timeout;
    let settleCallback: (result: { code: string; state: string }) => void;
    let failCallback: (error: Error) => void;
    const callback = new Promise<{ code: string; state: string }>((resolve, reject) => {
      settleCallback = resolve;
      failCallback = reject;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404);
        res.end();
        return;
      }

      server.close();
      clearTimeout(timer);

      const fail = (error: CommandError): void => {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_PAGE);
        failCallback(error);
      };

      const error = url.searchParams.get("error");
      if (error) {
        fail(
          new CommandError(
            `Authorization failed: ${error} — ${url.searchParams.get("error_description") ?? "no description"}`,
          ),
        );
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        fail(new CommandError("Callback did not include code and state query params."));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(SUCCESS_PAGE);
      settleCallback({ code, state });
    });

    server.on("error", (err) => {
      clearTimeout(timer);
      const reject = listening ? failCallback : failToStart;
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        describePortConflict(port).then(
          (message) => reject(new CommandError(message)),
          () => reject(err),
        );
        return;
      }
      reject(err);
    });

    server.on("listening", () => {
      listening = true;
      timer = setTimeout(() => {
        server.close();
        failCallback(new CommandError("Timed out waiting for the browser authorization callback."));
      }, timeoutMs);
      timer.unref?.();
      ready({
        callback,
        close: () => {
          clearTimeout(timer);
          server.close();
        },
      });
    });

    // Bind to loopback only so the authorization code is never accepted from other hosts.
    server.listen(port, "127.0.0.1");
  });
};
