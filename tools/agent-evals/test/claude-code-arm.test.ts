import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentAdapter, AgentInput, AgentOutput } from "@netlify/axis";
import { describe, expect, it } from "vitest";
import { createArmAdapter } from "../src/adapters/claude-code-arm.ts";

function fakeBase(calls: AgentInput[]): AgentAdapter {
  return {
    name: "claude-code",
    async run(input): Promise<AgentOutput> {
      calls.push(input);
      return {
        transcript: [],
        result: "ok",
        metadata: { startTime: "", endTime: "", durationMs: 0, exitCode: 0 },
      };
    },
  };
}

function inputFor(arm: string, configDir: string): AgentInput {
  return {
    prompt: "do it",
    config: { agent: "claude-code-arm", name: arm, flags: { verbose: true } },
    scenario: { key: "skills/plan", name: "x", prompt: "do it", judge: "x" },
    workingDirectory: os.tmpdir(),
    homeDirectory: path.dirname(configDir),
    env: { CLAUDE_CONFIG_DIR: configDir },
  };
}

function armsRootWithMonoblok(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arms-"));
  fs.mkdirSync(path.join(root, "arms/monoblok/skills/plan"), { recursive: true });
  fs.writeFileSync(path.join(root, "arms/monoblok/skills/plan/SKILL.md"), "# plan");
  fs.mkdirSync(path.join(root, "arms/monoblok/agents"), { recursive: true });
  fs.writeFileSync(path.join(root, "arms/monoblok/agents/reviewer.md"), "# reviewer");
  fs.mkdirSync(path.join(root, "arms/bare"), { recursive: true });
  return root;
}

function freshConfigDir(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "home-")), ".claude");
}

describe("claude-code-arm", () => {
  it("installs the arm's skills and agents into the job's config dir", async () => {
    const configDir = freshConfigDir();
    const adapter = createArmAdapter(fakeBase([]), {
      armsRoot: armsRootWithMonoblok(),
      pluginsFor: () => [],
    });
    await adapter.run(inputFor("monoblok", configDir));
    expect(fs.readFileSync(path.join(configDir, "skills/plan/SKILL.md"), "utf8")).toBe("# plan");
    expect(fs.readFileSync(path.join(configDir, "agents/reviewer.md"), "utf8")).toBe("# reviewer");
  });

  it("installs nothing for the bare arm", async () => {
    const configDir = freshConfigDir();
    const adapter = createArmAdapter(fakeBase([]), {
      armsRoot: armsRootWithMonoblok(),
      pluginsFor: () => [],
    });
    await adapter.run(inputFor("bare", configDir));
    expect(fs.existsSync(path.join(configDir, "skills"))).toBe(false);
    expect(fs.existsSync(path.join(configDir, "agents"))).toBe(false);
  });

  it("passes each plugin dir as --plugin-dir and keeps existing flags", async () => {
    const calls: AgentInput[] = [];
    const adapter = createArmAdapter(fakeBase(calls), {
      armsRoot: armsRootWithMonoblok(),
      pluginsFor: () => ["/plugins/superpowers"],
    });
    await adapter.run(inputFor("bare", freshConfigDir()));
    expect(calls[0].config.flags).toEqual({ verbose: true, "plugin-dir": "/plugins/superpowers" });
  });

  it("rejects an agent entry whose name is not an arm", async () => {
    const adapter = createArmAdapter(fakeBase([]), {
      armsRoot: armsRootWithMonoblok(),
      pluginsFor: () => [],
    });
    await expect(adapter.run(inputFor("nope", "/tmp/x/.claude"))).rejects.toThrow(/not an arm/);
  });

  it("fails when the arm was never prepared", async () => {
    const adapter = createArmAdapter(fakeBase([]), {
      armsRoot: fs.mkdtempSync(path.join(os.tmpdir(), "empty-")),
      pluginsFor: () => [],
    });
    await expect(adapter.run(inputFor("bare", "/tmp/x/.claude"))).rejects.toThrow(/prepare-arms/);
  });
});
