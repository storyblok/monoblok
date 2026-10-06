import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareArms } from "../scripts/prepare-arms.ts";

function fixtureRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arms-src-"));
  fs.mkdirSync(path.join(root, ".agents/skills/plan"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".agents/skills/plan/SKILL.md"),
    "---\nname: plan\nmodel: sonnet\n---\n# Plan\n",
  );
  fs.mkdirSync(path.join(root, ".claude/agents"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".claude/agents/reviewer.md"),
    "---\nname: reviewer\nmodel: opus\neffort: high\n---\n",
  );
  return root;
}

describe("prepareArms", () => {
  it("gives monoblok arms stripped skills plus agents, and other arms nothing", async () => {
    const sourceRoot = fixtureRepo();
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "arms-out-"));
    await prepareArms({ sourceRoot, outRoot, skipSuperpowers: true });

    for (const arm of ["monoblok", "monoblok-superpowers"]) {
      expect(fs.readFileSync(path.join(outRoot, "arms", arm, "skills/plan/SKILL.md"), "utf8")).toBe(
        "---\nname: plan\n---\n# Plan\n",
      );
      expect(fs.readFileSync(path.join(outRoot, "arms", arm, "agents/reviewer.md"), "utf8")).toBe(
        "---\nname: reviewer\n---\n",
      );
    }
    for (const arm of ["bare", "superpowers"]) {
      expect(fs.readdirSync(path.join(outRoot, "arms", arm))).toEqual([]);
    }
  });

  it("replaces stale arm contents on re-run", async () => {
    const sourceRoot = fixtureRepo();
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "arms-out-"));
    fs.mkdirSync(path.join(outRoot, "arms/monoblok/skills/deleted-skill"), { recursive: true });
    await prepareArms({ sourceRoot, outRoot, skipSuperpowers: true });
    expect(fs.readdirSync(path.join(outRoot, "arms/monoblok/skills"))).toEqual(["plan"]);
  });
});
