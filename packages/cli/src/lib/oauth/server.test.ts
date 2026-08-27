import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { startCallbackServer } from "./server";

const PATH = "/oauth/callback";
const STATE = "state-abc";
const callback = (port: number, query: string) => fetch(`http://127.0.0.1:${port}${PATH}${query}`);

describe("startCallbackServer", () => {
  it("should resolve with code and state and serve a 200 success page", async () => {
    const listener = await startCallbackServer(4917, PATH, STATE);
    const response = await callback(4917, "?code=auth-code&state=state-abc");

    expect(response.status).toBe(200);
    await expect(listener.callback).resolves.toEqual({ code: "auth-code", state: "state-abc" });
  });

  it("should serve a non-200 page and reject when the callback carries an error", async () => {
    const listener = await startCallbackServer(4918, PATH, STATE);
    // Attach the rejection assertion before triggering the callback so the
    // rejection is handled the moment it settles.
    const rejected = expect(listener.callback).rejects.toThrow(/access_denied/);
    const response = await callback(4918, "?error=access_denied&error_description=denied");

    expect(response.status).toBe(400);
    await rejected;
  });

  it("should reject before listening when the callback port is already in use", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(4920, "127.0.0.1", resolve));

    try {
      // Rejecting the start promise (rather than the callback promise) is what lets the login
      // flow report the conflict before it opens a browser tab. The holder lookup shells out to
      // lsof/netstat, which may be unavailable in CI, so the assertion covers the always-present
      // parts: the port, the cause, and the way out.
      await expect(startCallbackServer(4920, PATH, STATE)).rejects.toThrow(
        /Port 4920 is already in use .*run `storyblok login --oauth` again/s,
      );
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it("should serve a non-200 page and reject when code or state is missing", async () => {
    const listener = await startCallbackServer(4919, PATH, STATE);
    const rejected = expect(listener.callback).rejects.toThrow(/code and state/);
    const response = await callback(4919, "?code=only-code");

    expect(response.status).toBe(400);
    await rejected;
  });

  it("should stop listening once closed so the port is free again", async () => {
    const listener = await startCallbackServer(4921, PATH, STATE);
    listener.close();

    // A second bind on the same port only succeeds if the first server really let it go.
    const reopened = await startCallbackServer(4921, PATH, STATE);
    reopened.close();
  });

  it("should serve the failure page and reject when the returned state does not match", async () => {
    const listener = await startCallbackServer(4922, PATH, STATE);
    const rejected = expect(listener.callback).rejects.toThrow(/state mismatch/);
    const response = await callback(4922, "?code=auth-code&state=forged-state");

    // A forged callback must not be told it succeeded.
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Authorization failed");
    await rejected;
  });
});
