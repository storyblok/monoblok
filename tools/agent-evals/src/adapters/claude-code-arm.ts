import fs from "node:fs";
import path from "node:path";
import { getAdapter } from "@netlify/axis";
import type { AgentAdapter, AgentInput, AgentOutput } from "@netlify/axis";
import { EVALS_DIR, armDir, armPlugins, isArmName } from "../arms.ts";
import type { ArmName } from "../arms.ts";

type ArmAdapterOptions = { armsRoot?: string; pluginsFor?: (arm: ArmName) => string[] };

const INSTALLED_DIRS = ["skills", "agents"] as const;

export function createArmAdapter(
  base: AgentAdapter,
  options: ArmAdapterOptions = {},
): AgentAdapter {
  const armsRoot = options.armsRoot ?? EVALS_DIR;
  const pluginsFor = options.pluginsFor ?? armPlugins;
  return {
    ...base,
    name: "claude-code-arm",
    async run(input: AgentInput): Promise<AgentOutput> {
      const arm = input.config.name ?? "";
      if (!isArmName(arm)) throw new Error(`Agent entry "${arm}" is not an arm`);
      const source = armDir(arm, armsRoot);
      if (!fs.existsSync(source)) {
        throw new Error(`Arm "${arm}" missing at ${source}; run scripts/prepare-arms.ts`);
      }
      const configDir = input.env?.CLAUDE_CONFIG_DIR;
      if (!configDir) throw new Error("CLAUDE_CONFIG_DIR is not set for the job");
      for (const dir of INSTALLED_DIRS) {
        const from = path.join(source, dir);
        if (fs.existsSync(from)) fs.cpSync(from, path.join(configDir, dir), { recursive: true });
      }
      const [plugin] = pluginsFor(arm);
      const flags = plugin ? { ...input.config.flags, "plugin-dir": plugin } : input.config.flags;
      return base.run({ ...input, config: { ...input.config, flags } });
    },
  };
}

export default createArmAdapter(getAdapter("claude-code"));
