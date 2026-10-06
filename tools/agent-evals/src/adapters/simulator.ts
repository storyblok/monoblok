import { spawn } from "node:child_process";
import { SIMULATOR_MODEL } from "../arms.ts";

export type Simulate = (args: {
  brief: string;
  agentMessage: string;
  history: string[];
}) => Promise<string>;

const SYSTEM_PROMPT = [
  "You play the person who asked a coding agent for this work. Your knowledge is limited to the brief.",
  "Read the agent's latest message.",
  "If it asks you something, answer briefly from the brief. If the brief does not cover it, say",
  '"No preference, use your judgement." Never volunteer information the agent did not ask for.',
  "If it asks for approval of a design or plan, approve it unless it contradicts the brief; then say",
  "what contradicts it.",
  "If it asks nothing and the requested deliverable is done, reply with exactly DONE.",
  "Reply with the message only.",
].join(" ");

export function createSimulator(options: { configDir: string; model?: string }): Simulate {
  return ({ brief, agentMessage, history }) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        "claude",
        [
          "-p",
          "--model",
          options.model ?? SIMULATOR_MODEL,
          "--tools",
          "",
          "--disable-slash-commands",
          "--strict-mcp-config",
          "--system-prompt",
          SYSTEM_PROMPT,
        ],
        { env: { ...process.env, CLAUDE_CONFIG_DIR: options.configDir } },
      );
      let out = "";
      let err = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve(out.trim())
          : reject(new Error(`simulator exited ${code}: ${err.trim()}`)),
      );
      child.stdin.end(
        [
          `<brief>\n${brief}\n</brief>`,
          `<conversation>\n${history.join("\n\n")}\n</conversation>`,
          `<latest>\n${agentMessage}\n</latest>`,
        ].join("\n\n"),
      );
    });
}
