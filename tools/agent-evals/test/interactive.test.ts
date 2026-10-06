import type { AgentAdapter, AgentInput, AgentOutput } from "@netlify/axis";
import { describe, expect, it } from "vitest";
import { MAX_TURNS, createInteractiveAdapter } from "../src/adapters/interactive.ts";
import { caseIdFromKey } from "../src/case-key.ts";

function scriptedInner(replies: string[], calls: AgentInput[]): AgentAdapter {
  return {
    name: "claude-code-arm",
    async run(input): Promise<AgentOutput> {
      calls.push(input);
      const text = replies[calls.length - 1] ?? "done";
      return {
        transcript: [{ type: "assistant", timestamp: "", content: { text } }],
        result: text,
        metadata: {
          startTime: "",
          endTime: "",
          durationMs: 10,
          exitCode: 0,
          sessionId: "s1",
          tokenUsage: { input: 100, output: 10 },
          totalCostUsd: 0.5,
        },
      };
    },
  };
}

function input(): AgentInput {
  return {
    prompt: "/spec stories validate",
    config: { agent: "claude-code-interactive", name: "monoblok" },
    scenario: { key: "spec/spec@cli-stories-validate--monoblok", name: "x", prompt: "", judge: "" },
    workingDirectory: "/tmp",
    homeDirectory: "/tmp",
  };
}

describe("caseIdFromKey", () => {
  it("strips the scenario path and arm suffix", () => {
    expect(caseIdFromKey("spec/spec@cli-stories-validate--monoblok")).toBe("cli-stories-validate");
  });

  it("throws when the key has no variant", () => {
    expect(() => caseIdFromKey("spec/spec")).toThrow();
  });
});

describe("interactive adapter", () => {
  it("answers questions until the simulator says DONE, resuming the same session", async () => {
    const calls: AgentInput[] = [];
    const adapter = createInteractiveAdapter(
      scriptedInner(["Which flags?", "Spec written."], calls),
      {
        briefFor: (id) => `brief for ${id}`,
        simulatorFor:
          () =>
          async ({ agentMessage, brief }) => {
            expect(brief).toBe("brief for cli-stories-validate");
            return agentMessage === "Which flags?" ? "--starts-with and --format" : "DONE";
          },
      },
    );
    const out = await adapter.run(input());
    expect(calls.map((c) => c.prompt)).toEqual([
      "/spec stories validate",
      "--starts-with and --format",
    ]);
    expect(calls[0].config.flags?.resume).toBeUndefined();
    expect(calls[1].config.flags?.resume).toBe("s1");
    expect(out.transcript.map((t) => t.type)).toEqual(["assistant", "user", "assistant"]);
    expect(out.transcript.map((t) => JSON.stringify(t.content))).toEqual([
      expect.stringContaining("Which flags?"),
      expect.stringContaining("--starts-with and --format"),
      expect.stringContaining("Spec written."),
    ]);
    expect(out.metadata.tokenUsage).toEqual({ input: 200, output: 20 });
    expect(out.metadata.totalCostUsd).toBe(1);
    expect(out.metadata.durationMs).toBe(20);
  });

  it("stops after MAX_TURNS agent turns when the simulator never says DONE", async () => {
    const calls: AgentInput[] = [];
    const adapter = createInteractiveAdapter(scriptedInner([], calls), {
      briefFor: () => "",
      simulatorFor: () => async () => "keep going",
    });
    const out = await adapter.run(input());
    expect(calls).toHaveLength(MAX_TURNS);
    expect(out.result).toBe("done");
  });

  it("stops when a turn fails and reports that turn's error", async () => {
    const inner: AgentAdapter = {
      name: "x",
      async run(): Promise<AgentOutput> {
        return {
          transcript: [],
          result: null,
          metadata: { startTime: "", endTime: "", durationMs: 0, exitCode: 1, error: "boom" },
        };
      },
    };
    const adapter = createInteractiveAdapter(inner, {
      briefFor: () => "",
      simulatorFor: () => async () => "x",
    });
    const out = await adapter.run(input());
    expect(out.metadata.exitCode).toBe(1);
    expect(out.metadata.error).toBe("boom");
  });

  it("keeps earlier turns and reports an error when the simulator fails", async () => {
    const calls: AgentInput[] = [];
    const adapter = createInteractiveAdapter(scriptedInner(["Which flags?"], calls), {
      briefFor: () => "",
      simulatorFor: () => async () => {
        throw new Error("spawn failed");
      },
    });
    const out = await adapter.run(input());
    expect(out.transcript).toHaveLength(1);
    expect(out.metadata.tokenUsage).toEqual({ input: 100, output: 10 });
    expect(out.metadata.exitCode).toBe(1);
    expect(out.metadata.error).toBe("simulator: spawn failed");
  });

  it.each(["", "DONE.", "`DONE`", " done \n"])("treats %j as DONE", async (reply) => {
    const calls: AgentInput[] = [];
    const adapter = createInteractiveAdapter(scriptedInner(["Spec written."], calls), {
      briefFor: () => "",
      simulatorFor: () => async () => reply,
    });
    await adapter.run(input());
    expect(calls).toHaveLength(1);
  });
});
