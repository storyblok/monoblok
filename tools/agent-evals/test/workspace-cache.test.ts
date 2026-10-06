import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cloneCachedDirectory } from "../src/workspace-cache.ts";

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("cloneCachedDirectory", () => {
  it("builds once per key and gives every target its own copy", () => {
    const cacheRoot = tempDir("cache-");
    let builds = 0;
    const build = (dir: string): void => {
      builds++;
      fs.mkdirSync(path.join(dir, "src"));
      fs.writeFileSync(path.join(dir, "src/index.ts"), "original");
      fs.symlinkSync("src/index.ts", path.join(dir, "link.ts"));
    };
    const first = tempDir("ws-");
    const second = tempDir("ws-");

    cloneCachedDirectory({ cacheRoot, key: "case-a", target: first, build });
    fs.writeFileSync(path.join(first, "src/index.ts"), "edited by an agent");
    cloneCachedDirectory({ cacheRoot, key: "case-a", target: second, build });

    expect(builds).toBe(1);
    expect(fs.readFileSync(path.join(second, "src/index.ts"), "utf8")).toBe("original");
    expect(fs.readlinkSync(path.join(second, "link.ts"))).toBe("src/index.ts");
  });

  it("rebuilds after a failed build instead of serving a partial result", () => {
    const cacheRoot = tempDir("cache-");
    const failing = (): void => {
      throw new Error("install failed");
    };
    expect(() =>
      cloneCachedDirectory({ cacheRoot, key: "k", target: tempDir("ws-"), build: failing }),
    ).toThrow("install failed");

    const target = tempDir("ws-");
    cloneCachedDirectory({
      cacheRoot,
      key: "k",
      target,
      build: (dir) => fs.writeFileSync(path.join(dir, "ok"), ""),
    });
    expect(fs.readdirSync(target)).toEqual(["ok"]);
  });
});
