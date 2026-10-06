import fs from "node:fs";
import path from "node:path";
import { getAdapter } from "@netlify/axis";
import type { AgentAdapter, AgentInput, AgentOutput } from "@netlify/axis";
import { EVALS_DIR, armDir, armPlugins, isArmName } from "../arms.ts";
import type { ArmName } from "../arms.ts";

type ArmAdapterOptions = { armsRoot?: string; pluginsFor?: (arm: ArmName) => string[] };

const INSTALLED_DIRS = ["skills", "agents"] as const;

/** AXIS passes its own variables (config dir, lifecycle context) to the job; they point the agent at the eval harness. */
const HARNESS_ENV_PREFIX = "AXIS_";

function withoutHarnessEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !key.startsWith(HARNESS_ENV_PREFIX)),
  );
}

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
      const { env } = input;
      const configDir = env?.CLAUDE_CONFIG_DIR;
      if (!env || !configDir) throw new Error("CLAUDE_CONFIG_DIR is not set for the job");
      for (const dir of INSTALLED_DIRS) {
        const from = path.join(source, dir);
        if (fs.existsSync(from)) fs.cpSync(from, path.join(configDir, dir), { recursive: true });
      }
      const plugins = pluginsFor(arm);
      // The flag map holds one value per flag, so a second plugin would be dropped silently.
      if (plugins.length > 1) throw new Error(`Arm "${arm}" has more than one plugin`);
      const [plugin] = plugins;
      const flags = plugin ? { ...input.config.flags, "plugin-dir": plugin } : input.config.flags;
      return base.run({
        ...input,
        env: withoutHarnessEnv(env),
        config: { ...input.config, flags },
      });
    },
  };
}

export default createArmAdapter(getAdapter("claude-code"));
