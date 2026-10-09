import { discoverScenarios, loadConfig } from "@netlify/axis";
import type { AxisConfig, Scenario } from "@netlify/axis";
import path from "node:path";

export type Discovered = { config: AxisConfig; scenarios: Scenario[] };

const CONFIG_PATH = path.resolve(import.meta.dirname, "../axis.config.ts");

export async function discover(profile?: string): Promise<Discovered> {
  const { config, configDir } = await loadConfig(CONFIG_PATH, { profile });
  const scenarios = await discoverScenarios(configDir, config.scenarios, undefined, {
    include: config.include,
    exclude: config.exclude,
  });
  return { config, scenarios };
}
