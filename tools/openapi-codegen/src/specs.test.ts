import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSpecPaths, sha256, type SpecLock, type SpecStore, writeSpecLock } from "./specs.ts";

const CAPI = "capi: 1\n";
const MAPI = "mapi: 1\n";

describe("resolveSpecPaths", () => {
  let dir: string;
  let store: SpecStore;
  let server: Server;
  let origin: string;
  let served: Record<string, string>;
  let requests: string[];

  function pin(path: string, content: string): SpecLock[keyof SpecLock] {
    return { url: `${origin}${path}`, sha256: sha256(Buffer.from(content)) };
  }

  function lockServedSpecs(): SpecLock {
    const lock = { capi: pin("/capi.yaml", CAPI), mapi: pin("/mapi.yaml", MAPI) };
    writeSpecLock(lock, store);
    return lock;
  }

  beforeEach(async () => {
    dir = mkdtempSync(resolve(tmpdir(), "openapi-codegen-specs-"));
    store = { lockPath: resolve(dir, "spec.lock.json"), cacheDir: resolve(dir, "cache") };
    served = { "/capi.yaml": CAPI, "/mapi.yaml": MAPI };
    requests = [];
    server = createServer((request, response) => {
      requests.push(request.url ?? "");
      const body = served[request.url ?? ""];
      response.writeHead(body === undefined ? 404 : 200).end(body);
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((done) => server.close(done));
    rmSync(dir, { recursive: true, force: true });
  });

  it("should download the pinned specs once and reuse them", async () => {
    lockServedSpecs();

    const first = await resolveSpecPaths(store);
    const second = await resolveSpecPaths(store);

    expect(readFileSync(first.capi, "utf8")).toBe(CAPI);
    expect(readFileSync(first.mapi, "utf8")).toBe(MAPI);
    expect(second).toEqual(first);
    expect(requests.sort()).toEqual(["/capi.yaml", "/mapi.yaml"]);
  });

  it("should reject a download that doesn't match its pin", async () => {
    lockServedSpecs();
    served["/mapi.yaml"] = "mapi: 2\n";

    await expect(resolveSpecPaths(store)).rejects.toThrow("spec.lock.json pins");
  });

  it("should download a cached spec again when the cached copy is corrupt", async () => {
    lockServedSpecs();
    const { capi } = await resolveSpecPaths(store);
    writeFileSync(capi, "corrupt\n");

    await resolveSpecPaths(store);

    expect(readFileSync(capi, "utf8")).toBe(CAPI);
    expect(requests.filter((url) => url === "/capi.yaml")).toHaveLength(2);
  });

  it("should fail when a pinned spec is unavailable", async () => {
    lockServedSpecs();
    delete served["/capi.yaml"];

    await expect(resolveSpecPaths(store)).rejects.toThrow("404");
  });
});
