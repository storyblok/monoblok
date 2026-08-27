import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { mkdir, utimes } from "node:fs/promises";
import { readCredentialsFile, updateCredentialsFile } from "./credentials-file";

vi.mock("node:fs");
vi.mock("node:fs/promises");

const credentialsPath = `${process.env.HOME}/.storyblok/credentials.json`;

describe("credentials file", () => {
  beforeEach(() => vol.reset());
  afterEach(() => vi.useRealTimers());

  it("should keep both entries when two writers update it at the same time", async () => {
    await Promise.all([
      updateCredentialsFile((credentials) => ({ ...credentials, pat: "token" })),
      updateCredentialsFile((credentials) => ({ ...credentials, oauth: { eu: {} } })),
    ]);

    expect(await readCredentialsFile()).toEqual({ pat: "token", oauth: { eu: {} } });
  });

  it("should write the file readable only by its owner and leave no temp file behind", async () => {
    await updateCredentialsFile(() => ({ pat: "token" }));

    expect(vol.statSync(credentialsPath).mode & 0o777).toBe(0o600);
    expect(Object.keys(vol.toJSON())).toEqual([credentialsPath]);
  });

  it("should tighten the permissions of a file that was already too permissive", async () => {
    vol.fromJSON({ [credentialsPath]: JSON.stringify({ pat: "token" }) });
    vol.chmodSync(credentialsPath, 0o644);

    await updateCredentialsFile((credentials) => ({ ...credentials, extra: true }));

    expect(vol.statSync(credentialsPath).mode & 0o777).toBe(0o600);
  });

  it("should reclaim a lock left behind by a crashed process", async () => {
    await mkdir(`${process.env.HOME}/.storyblok`, { recursive: true });
    await mkdir(`${credentialsPath}.lock`);
    const longAgo = new Date(Date.now() - 60_000);
    await utimes(`${credentialsPath}.lock`, longAgo, longAgo);

    await updateCredentialsFile(() => ({ pat: "token" }));

    expect(await readCredentialsFile()).toEqual({ pat: "token" });
  });

  it("should read a corrupt file as empty rather than throwing", async () => {
    vol.fromJSON({ [credentialsPath]: "{ truncated" });

    expect(await readCredentialsFile()).toEqual({});
  });
});
