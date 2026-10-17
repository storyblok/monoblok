import type { AgentAdapter, AgentInput, AgentOutput, TranscriptEntry } from "@netlify/axis";
import { caseIdFromKey } from "../case-key.ts";
import type { Simulate } from "./simulator.ts";

export const MAX_TURNS = 16;
export const DONE = "DONE";

type InteractiveOptions = {
  briefFor: (caseId: string) => string;
  simulatorFor: (input: AgentInput) => Simulate;
};

function isDone(reply: string): boolean {
  const normalized = reply.replace(/^[\s`*"'.!]+|[\s`*"'.!]+$/g, "");
  return normalized === "" || normalized.toUpperCase() === DONE;
}

function userEntry(text: string): TranscriptEntry {
  return {
    type: "user",
    timestamp: new Date().toISOString(),
    content: { type: "user", message: { role: "user", content: [{ type: "text", text }] } },
  };
}

export function createInteractiveAdapter(
  inner: AgentAdapter,
  options: InteractiveOptions,
): AgentAdapter {
  return {
    ...inner,
    name: "claude-code-interactive",
    async run(input: AgentInput): Promise<AgentOutput> {
      const brief = options.briefFor(caseIdFromKey(input.scenario.key));
      const startTime = new Date().toISOString();
      const transcript: TranscriptEntry[] = [];
      const history: string[] = [];
      let simulate: Simulate | undefined;
      let prompt = input.prompt;
      let last: AgentOutput | undefined;
      let inputTokens = 0;
      let outputTokens = 0;
      let cost = 0;
      let durationMs = 0;
      let simulatorError: string | undefined;
      let stoppedEarly = false;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const resume = last?.metadata.sessionId;
        const flags = resume ? { ...input.config.flags, resume } : input.config.flags;
        last = await inner.run({ ...input, prompt, config: { ...input.config, flags } });
        if (turn > 0) transcript.push(userEntry(prompt));
        transcript.push(...last.transcript);
        inputTokens += last.metadata.tokenUsage?.input ?? 0;
        outputTokens += last.metadata.tokenUsage?.output ?? 0;
        cost += last.metadata.totalCostUsd ?? 0;
        durationMs += last.metadata.durationMs;
        if (last.metadata.exitCode !== 0) {
          stoppedEarly = true;
          break;
        }

        const agentMessage = last.result ?? "";
        history.push(`Agent: ${agentMessage}`);
        let reply: string;
        try {
          simulate ??= options.simulatorFor(input);
          reply = await simulate({ brief, agentMessage, history });
        } catch (error) {
          simulatorError = error instanceof Error ? error.message : String(error);
          stoppedEarly = true;
          break;
        }
        reply = reply.trim();
        if (isDone(reply)) {
          stoppedEarly = true;
          break;
        }
        history.push(`User: ${reply}`);
        prompt = reply;
      }

      if (!stoppedEarly)
        transcript.push(userEntry(`simulated user: turn limit reached (${MAX_TURNS})`));
      if (!last) throw new Error("interactive adapter ran no turns");
      return {
        transcript,
        result: last.result,
        metadata: {
          ...last.metadata,
          ...(simulatorError && { exitCode: 1, error: `simulator: ${simulatorError}` }),
          startTime,
          endTime: new Date().toISOString(),
          durationMs,
          tokenUsage: { input: inputTokens, output: outputTokens },
          totalCostUsd: cost,
        },
      };
    },
  };
}
