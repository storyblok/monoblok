import type { AxisConfig } from "@netlify/axis";
import { ARM_NAMES, EVAL_MODEL } from "./src/arms.ts";

const hasQaSpace = Boolean(process.env.STORYBLOK_SPACE_ID);

const config: AxisConfig = {
  name: "monoblok agent evals",
  scenarios: "./scenarios",
  adapters: { "claude-code-arm": "./src/adapters/claude-code-arm.ts" },
  agents: ARM_NAMES.map((name) => ({ agent: "claude-code-arm", name, model: EVAL_MODEL })),
  judging: { agents: [{ agent: "claude-code", model: EVAL_MODEL }] },
  afterAll: [{ action: "run_script", command: "node ./scripts/compare.ts" }],
  env: ["STORYBLOK_SPACE_ID", "npm_config_store_dir"],
  exclude: ["spec/**"],
  settings: {
    concurrency: 3,
    limits: { scenario: { time_minutes: 30 } },
  },
  profiles: {
    skills: {
      include: ["skills/**"],
      settings: { concurrency: 3, limits: { scenario: { time_minutes: 40 } } },
    },
    cli: {
      include: ["cli/**"],
      agents: [{ agent: "claude-code-arm", name: "bare", model: EVAL_MODEL }],
      settings: { concurrency: 1, limits: { scenario: { time_minutes: 10 } } },
      beforeAll: hasQaSpace
        ? [{ action: "run_script", command: "bash ./scripts/seed.sh has-stories" }]
        : [],
    },
    spec: {
      include: ["spec/**"],
      exclude: [],
      adapters: {
        "claude-code-arm": "./src/adapters/claude-code-arm.ts",
        "claude-code-interactive": "./src/adapters/claude-code-interactive.ts",
      },
      agents: ARM_NAMES.map((name) => ({
        agent: "claude-code-interactive",
        name,
        model: EVAL_MODEL,
      })),
      settings: { concurrency: 3, limits: { scenario: { time_minutes: 30 } } },
    },
  },
};

export default config;
