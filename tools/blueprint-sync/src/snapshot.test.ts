import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { snapshot } from "./snapshot.ts";

describe("snapshot", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "blueprint-sync-snapshot-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("should restore a file that was rewritten", () => {
    writeFileSync(join(dir, "env.ts"), "token: 'PLACEHOLDER'");
    const restore = snapshot(dir, ["env.ts"]);
    writeFileSync(join(dir, "env.ts"), "token: 'secret'");

    restore();

    expect(readFileSync(join(dir, "env.ts"), "utf8")).toBe("token: 'PLACEHOLDER'");
  });

  it("should delete a file that did not exist", () => {
    const restore = snapshot(dir, ["new.ts"]);
    writeFileSync(join(dir, "new.ts"), "");

    restore();

    expect(existsSync(join(dir, "new.ts"))).toBe(false);
  });
});
