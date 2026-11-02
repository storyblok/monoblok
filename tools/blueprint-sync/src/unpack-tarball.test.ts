import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/unpack-tarball.sh", import.meta.url));

// The sync workflow's push job runs this on Linux. Windows has no bash to test it with.
describe.skipIf(process.platform === "win32")("unpack-tarball.sh", () => {
  let work: string;
  let src: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), "unpack-tarball-"));
    src = join(work, "src");
    mkdirSync(join(src, "src"), { recursive: true });
    writeFileSync(join(src, "package.json"), "{}\n");
    writeFileSync(join(src, "src/main.js"), "");
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  /** Packs `members` (relative to `src`) and returns the tarball and its sha256. */
  const pack = (members: string[], flags: string[] = []): { tarball: string; sha: string } => {
    const tarball = join(work, "blueprint.tgz");
    execFileSync("tar", ["-czf", tarball, ...flags, "-C", src, ...members]);
    return { tarball, sha: createHash("sha256").update(readFileSync(tarball)).digest("hex") };
  };

  const unpack = (tarball: string, sha: string) =>
    spawnSync("bash", [SCRIPT, tarball, sha, join(work, "out")], { encoding: "utf8" });

  it("should unpack a tarball of files and directories", () => {
    const { tarball, sha } = pack(["."]);

    const result = unpack(tarball, sha);

    expect(result.status).toBe(0);
    expect(existsSync(join(work, "out/src/main.js"))).toBe(true);
  });

  it("should refuse a tarball that is not the one stage hashed", () => {
    const { tarball } = pack(["."]);

    expect(unpack(tarball, "0".repeat(64)).stderr).toContain("does not match the hash");
    expect(unpack(tarball, "").stderr).toContain("does not match the hash");
    expect(existsSync(join(work, "out"))).toBe(false);
  });

  it("should refuse a .git member", () => {
    mkdirSync(join(src, ".git/hooks"), { recursive: true });
    writeFileSync(join(src, ".git/hooks/pre-commit"), "#!/bin/sh\n");
    const { tarball, sha } = pack(["."]);

    const result = unpack(tarball, sha);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("has a .git");
    expect(existsSync(join(work, "out"))).toBe(false);
  });

  it("should keep .github and .gitignore, which are not .git", () => {
    writeFileSync(join(src, ".gitignore"), ".env\n");
    const { tarball, sha } = pack(["."]);

    expect(unpack(tarball, sha).status).toBe(0);
    expect(existsSync(join(work, "out/.gitignore"))).toBe(true);
  });

  it("should refuse a destination that exists", () => {
    const { tarball, sha } = pack(["."]);
    mkdirSync(join(work, "out"));

    expect(unpack(tarball, sha).stderr).toContain("already exists");
  });
});
