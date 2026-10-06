import type { AxisConfig } from "@netlify/axis";

const hasQaSpace = Boolean(process.env.STORYBLOK_SPACE_ID);

const config: AxisConfig = {
  name: "monoblok agent evals",
  scenarios: "./scenarios",
  agents: ["claude-code"],
  env: ["STORYBLOK_SPACE_ID"],
  settings: {
    concurrency: 3,
    limits: { scenario: { time_minutes: 30 } },
  },
  profiles: {
    cli: {
      include: ["cli/**"],
      settings: { concurrency: 1, limits: { scenario: { time_minutes: 10 } } },
      beforeAll: hasQaSpace
        ? [{ action: "run_script", command: "bash ./scripts/seed.sh has-stories" }]
        : [],
    },
  },
};

export default config;
