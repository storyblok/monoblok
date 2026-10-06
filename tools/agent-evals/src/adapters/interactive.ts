import type { AgentAdapter, AgentInput, AgentOutput, TranscriptEntry } from "@netlify/axis";
import { caseIdFromKey } from "../case-key.ts";
import type { Simulate } from "./simulator.ts";

export const MAX_TURNS = 8;
export const DONE = "DONE";

type InteractiveOptions = {
  briefFor: (caseId: string) => string;
  simulatorFor: (input: AgentInput) => Simulate;
};

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
        if (last.metadata.exitCode !== 0) break;

        const agentMessage = last.result ?? "";
        history.push(`Agent: ${agentMessage}`);
        simulate ??= options.simulatorFor(input);
        const reply = (await simulate({ brief, agentMessage, history })).trim();
        if (reply === DONE) break;
        history.push(`User: ${reply}`);
        prompt = reply;
      }

      if (!last) throw new Error("interactive adapter ran no turns");
      return {
        transcript,
        result: last.result,
        metadata: {
          ...last.metadata,
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
